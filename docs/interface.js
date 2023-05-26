const WASM_URL = '/lminc_web.wasm';

// -- Load the WASM module --

await WebAssembly.instantiateStreaming( fetch( WASM_URL ) )
    .then( instance => {
        window.instance = instance;

        let wasm = instance.instance.exports;
        window.wasm = wasm;

        const code_base = wasm.get_code_base();
        window.code = new Uint8Array(
            wasm.memory.buffer,
            code_base,
            wasm.memory.buffer.byteLength - code_base
        );
    } );

// -- Create text encoders and decoders --

const utf8Encode = new TextEncoder();
const utf8Decode = new TextDecoder();

// -- Set the code in the memory --

function set_code( code ) {
    if ( typeof code !== 'string' )
        throw new TypeError( 'code must be a string' );

    const result = utf8Encode.encodeInto( code, window.code );

    window.wasm.set_code_length( result.written );
}
window.set_code = set_code;

// -- Get an error from memory --

function get_error( base ) {
    const length = window.wasm.get_error_length();

    const buffer = new Uint8Array(
        window.wasm.memory.buffer,
        base,
        length
    );

    return utf8Decode.decode( buffer );
}
window.get_error = get_error;

// -- Parse the loaded code, returning errors as strings --

function parse( text ) {
    set_code( text );
    
    const result = window.wasm.parse();
    if ( result !== 0 ) {
        const error = get_error( result );
        console.error( error );
        return error;
    }

    return true;
}
window.parse = parse;

// -- Assemble the parsed code, returning errors as strings --

function assemble() {
    const result = window.wasm.assemble();
    if ( result !== 0 ) {
        const error = get_error( result );
        console.error( error );
        return error;
    }

    window.wasm.initialise();

    return true;
}
window.assemble = assemble;
