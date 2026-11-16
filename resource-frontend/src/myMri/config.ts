import toolConfig from '@/assets/tool_config.json'

export interface ToolConfig {
  user_info: { uuid: string }
  assay_info: {
    uuid: string
    name: string
    cohorts: string[]
    datasets: { name: string, sample_type: string[] }[]
  }
  system: { minio: { base_url: string } }
}

/**
 * The tool config the patient pages (My Images, My Report) read. Today it is the bundled JSON; this
 * is the one function the portal will replace to supply its own.
 */
export function getToolConfig(): ToolConfig {
  return toolConfig as ToolConfig
}
