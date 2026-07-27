/// <reference types="vite/client" />

// iPhone-skärmbilderna har versala filändelser, Vite hanterar dem som
// vanliga bilder men TypeScript behöver deklarationen
declare module "*.PNG" {
  const src: string
  export default src
}
