// @types/pdfmake types the main entry and 'pdfmake/interfaces', but not the
// browser build subpaths. We import those lazily and treat them as untyped.
declare module 'pdfmake/build/pdfmake';
declare module 'pdfmake/build/vfs_fonts';
