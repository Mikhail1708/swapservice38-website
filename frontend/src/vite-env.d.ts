/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_API_URL: string
  readonly VITE_YANDEX_REDIRECT_URI: string
  readonly VITE_YANDEX_GEOCODER_API_KEY: string
  readonly VITE_DADATA_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}

declare module '*.scss' {
  const content: { [className: string]: string }
  export default content
}