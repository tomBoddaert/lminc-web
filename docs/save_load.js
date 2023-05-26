// -- Define load and save functions --

async function load() {
    try {
        const [ fileHandle ] = await window.showOpenFilePicker( {
            types: [ {
                description: 'LMinC Assembly',
                accept: {
                    'text/plain': [ '.txt' ],
                },
            } ],
        } );

        const file = await fileHandle.getFile();
        const content = await file.text();

        window.setCode( content );
    } catch ( error ) {
        if ( error instanceof TypeError )
            alert( 'The file does not contain text!' );

        console.error( error );
        return;
    }
}
window.load = load;

async function save() {
    try {
        const fileHandle = await window.showSaveFilePicker( {
            types: [ {
                description: 'LMinC Assembly',
                accept: {
                    'text/plain': [ '.txt' ],
                },
            } ]
        } );

        const writable = await fileHandle.createWritable();
        const content = window.getCode();

        await writable.write( content );
        await writable.close();
    } catch ( error ) {
        console.error( error );
        return;
    }
}
window.save = save;

// -- Bind the functions to the buttons --

document.querySelectorAll( '#EditorButtons > *' )
    .forEach( element => {
        switch ( element.innerText ) {
            case 'Run':
                element.addEventListener( 'click', () => {
                    window.sessionSwitch( 'Editor' );
                    window.execute( window.editor );
                } );
                break;

            case 'Load':
                element.addEventListener( 'click', load );
                break

            case 'Save':
                element.addEventListener( 'click', save );
                break;

            default:
                break;
        }
    } );
