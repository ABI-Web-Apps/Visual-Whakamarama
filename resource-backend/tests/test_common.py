"""app.router.common: the client key the rate limits use."""

import ipaddress

import pytest
from starlette.requests import Request

from app.router.common import client_key

# Really global (`ipaddress.ip_address(x).is_global`); TEST-NET ranges such as 203.0.113.0/24
# are not, and would be treated like a proxy's private address.
REAL = "1.1.1.1"
SPOOFED = "8.8.4.4"
PROXY = "172.18.0.2"


def _request(forwarded: str | None, peer: str | None = PROXY) -> Request:
    headers = [] if forwarded is None else [(b"x-forwarded-for", forwarded.encode("latin-1"))]
    scope = {"type": "http", "method": "POST", "path": "/", "headers": headers}
    if peer is not None:
        scope["client"] = (peer, 51234)
    return Request(scope)


def test_the_addresses_are_what_the_tests_claim():
    assert ipaddress.ip_address(REAL).is_global and ipaddress.ip_address(SPOOFED).is_global
    assert not ipaddress.ip_address(PROXY).is_global


def test_the_right_most_global_address_is_the_client():
    assert client_key(_request(f"{SPOOFED}, {REAL}, {PROXY}")) == REAL
    assert client_key(_request(f"{REAL}, {PROXY}")) == REAL
    assert client_key(_request(REAL)) == REAL


def test_a_spoofed_public_address_left_of_the_real_one_is_ignored():
    # Every nginx layer appends to what the client sent, so the client controls the left side.
    assert client_key(_request(f"{SPOOFED}, {REAL}")) == REAL
    assert client_key(_request(f"6.6.6.6, 9.9.9.9, {SPOOFED}, {REAL}, 10.0.0.7, {PROXY}")) == REAL


def test_all_private_is_the_right_most_entry():
    assert client_key(_request("10.9.9.9, 192.168.1.5")) == "192.168.1.5"
    assert client_key(_request("203.0.113.7")) == "203.0.113.7"


def test_garbage_entries_are_skipped():
    assert client_key(_request(f"unknown, {REAL}, not-an-ip, 1.2.3.4:5678, , {PROXY}")) == REAL
    assert client_key(_request("10.9.9.9, garbage")) == "10.9.9.9"
    assert client_key(_request(f"  {REAL}  ,{PROXY}")) == REAL


def test_ipv6_is_read_and_written_in_one_form():
    assert client_key(_request(f"2001:4860:4860:0:0:0:0:8888, {PROXY}")) == "2001:4860:4860::8888"


@pytest.mark.parametrize("forwarded", [None, "", "  ", "garbage, unknown"])
def test_no_usable_header_is_the_peer_address(forwarded):
    assert client_key(_request(forwarded, peer="172.18.0.9")) == "172.18.0.9"


def test_no_header_and_no_peer_is_unknown():
    assert client_key(_request(None, peer=None)) == "unknown"
