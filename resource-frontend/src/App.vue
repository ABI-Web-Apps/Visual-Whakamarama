<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import AppToast from '@/components/common/AppToast.vue'
import FeedbackWidget from '@/components/feedback/FeedbackWidget.vue'
import { provideToast } from '@/composables/useToast'
import { provideFeedbackDialog } from '@/feedback/useFeedbackDialog'
import { useAdminShortcut } from '@/utils/adminShortcut'
import { createAppRouter, provideAppRouter } from '@/navigation/router'
import { pageKeyFor } from '@/utils/pageKey'
import AboutPage from '@/pages/AboutPage.vue'
import CasePage from '@/pages/CasePage.vue'
import ContactPage from '@/pages/ContactPage.vue'
import FeedbackReviewPage from '@/pages/FeedbackReviewPage.vue'
import MyImagesMriPage from '@/pages/MyImagesMriPage.vue'
import MyImagesPage from '@/pages/MyImagesPage.vue'
import MyReportPage from '@/pages/MyReportPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'

/**
 * The app shell: one router, one page on screen, pages kept alive.
 *
 * Standalone, the address bar drives the page. As a plugin, navigation is in
 * memory and starts at `/`, which redirects to the home case -- the same
 * first page a visitor to the site's root gets.
 */
const router = createAppRouter({
  history: !__IS_PLUGIN__,
  base: import.meta.env.BASE_URL,
})
provideAppRouter(router)
// One toast for every page (the email buttons' "copied").
provideToast()
// The feedback dialog: drawn by FeedbackWidget below, opened from About and Contact us too.
provideFeedbackDialog()
// The team's inbox: Ctrl + Shift + F from anywhere (it still asks for the password).
useAdminShortcut(() => { void router.navigateTo('/feedback-review') })

onMounted(() => router.start())
onBeforeUnmount(() => router.stop())

const route = router.route

/**
 * Decides when the case page's component instance -- and the WebGL
 * renderers inside it -- is reused rather than rebuilt. The rule lives in
 * `utils/pageKey.ts`, where it is documented and unit-tested: every case
 * shares one key, so stepping between cases keeps every decoded scene.
 *
 * Every other page keys on its name, so a path typed in another case is the
 * same page, not a second kept-alive copy of it.
 */
const pageKey = computed(() => pageKeyFor(route.value))
const page = computed(() => {
  switch (route.value.name) {
    case 'case': return CasePage
    case 'contact': return ContactPage
    case 'feedback-review': return FeedbackReviewPage
    case 'my-report': return MyReportPage
    case 'my-images': return MyImagesPage
    case 'my-images-mri': return MyImagesMriPage
    default: return AboutPage
  }
})
</script>

<template>
  <!--
    A 404 replaces the kept-alive tree rather than joining it, the way a Nuxt
    error page replaced the whole app: the cached pages (and their renderers)
    are released, and "Go back home" starts afresh.
  -->
  <NotFoundPage v-if="route.name === 'not-found'" :path="route.path" />
  <KeepAlive v-else>
    <component :is="page" :key="pageKey" :route="route" />
  </KeepAlive>
  <!-- On every page, 404 included: outside the kept-alive tree. -->
  <FeedbackWidget />
  <AppToast />
</template>
