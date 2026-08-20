// libheif-js ships no types for the wasm-bundle entry point; only the two calls ImageFit
// makes are declared here.
declare module "libheif-js/wasm-bundle" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(image: ImageData, callback: (result: ImageData | null) => void): void;
  }

  interface HeifDecoderModule {
    HeifDecoder: new () => { decode(buffer: Uint8Array): HeifImage[] };
  }

  const module: HeifDecoderModule;
  export default module;
}
