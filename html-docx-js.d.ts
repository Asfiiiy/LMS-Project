declare module 'html-docx-js/dist/html-docx.js' {
  const htmlDocx: {
    asBlob: (html: string) => Blob;
  };
  export default htmlDocx;
}
