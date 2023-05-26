const SAMPLE_CODE = `\
# This example outputs some of the Van Eck sequence
#  (https://oeis.org/A181391)
# Use the 'Run' button above to run it

loop    LDA current     # load and output the current value
        OUT

        ADD base_a      # translate that to the value's index address
        STO c_addr
        LDA c_addr

        ADD sto_n       # make a store instruction from the index address
        STO sto_c
        ADD d_lda_n     # make a load instruction from the store instruction
        STO lda_c

        SUB lda_max     # make sure the index is not > 99 (not load > 599)
        BRP exit

        LDA counter     # increment the counter
        ADD one
        STO counter

lda_c   DAT 0           # (modified) load the last index of the current value
        BRZ update      # if zero, skip to [update]

        STO c_index     # calculate counter - last index
        LDA counter
        SUB c_index

update  STO current     # set as the next number

        LDA counter     # load the counter
sto_c   DAT 0           # (modified) store as the last index of the (old) current number
        BR loop         # go to the start of the loop

exit    HLT             # stop

# state
current DAT 0           # the current number
counter DAT 0           # the counter
c_addr  DAT 0           # the address of the last index of the current number
c_index DAT 0           # (cache) the last index of the current number

# constants
one     DAT 1
sto_n   DAT 300         # op code of STO
d_lda_n DAT 200         # op code of LDA - op code of STO
lda_max DAT 599         # max address + op code of LDA

# base for last index storage
base_a  DAT base        # index of the base
base    DAT 0
`

// -- Define LMinC mode --

ace.define(
    'ace/mode/lminc',
    [ 'require', 'exports', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/lminc_highlight_rules' ],
    ( require, exports ) => {
        const oop = require( 'ace/lib/oop' );
        const TextMode = require( 'ace/mode/text' ).Mode;
        const LMinCHighlightRules = ace.require( 'ace/mode/lminc_highlight_rules' ).LMinCHighlightRules;

        const Mode = function() {
            this.HighlightRules = LMinCHighlightRules;
            this.$behaviour = this.$defaultBehaviour;
        };

        oop.inherits( Mode, TextMode );

        exports.Mode = Mode;
} );

ace.define(
    'ace/mode/lminc_highlight_rules',
    [ 'require', 'exports', 'ace/lib/oop', 'ace/mode/text_highlight_rules' ],
    ( require, exports ) => {
        const oop = require( 'ace/lib/oop' );
        const TextHighlightRules = require( 'ace/mode/text_highlight_rules' ).TextHighlightRules;

        const LMinCHighlightRules = function() {
            this.$rules = { start: [
                { token: 'keyword.control',
                    regex: '\\b(?:in|out|ina|ota|hlt|ext)\\b',
                    caseInsensitive: true },
                { token: 'keyword.operator',
                    regex: '\\b(?:add|sub|lda|sto|sta|lda|br|bra|brp|brz|dat)\\b',
                    caseInsensitive: true },
                { token: 'constant.numeric',
                    regex: '\\b[0-9]+\\b' },
                { token: 'comment.assembly',
                    regex: '[;#].*$' } ] };
            
            this.normalizeRules();
        };

        LMinCHighlightRules.metaData = { fileTypes: [ 'lminc' ],
            name: 'LMinC Assembly',
            scopeName: 'source.assembly' };

        oop.inherits( LMinCHighlightRules, TextHighlightRules );

        exports.LMinCHighlightRules = LMinCHighlightRules;
} );

// -- Create editor --

const editor = ace.edit( 'Editor', {
    theme: 'ace/theme/github_dark',
    tabSize: 4,
    useSoftTabs: true,
    navigateWithinSoftTabs: true,
    showPrintMargin: false,
    maxLines: Infinity,
} );
window.editor = editor;

// -- Define sessions --

let sessionName = 'Editor';

const sessions = {
    Editor: ace.createEditSession( SAMPLE_CODE, 'ace/mode/lminc' ),
    Output: ace.createEditSession( '', 'ace/mode/text' ),
    Input: ace.createEditSession( '', 'ace/mode/text' ),
};
Object.entries( sessions ).forEach( ( [ name, session ] ) => session.id = name );

const readOnlySessions = {
    Output: true,
    Input: true
};

const commands = {
    Editor: [ {
        name: 'run',
        bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
        exec: execute
    } ],
    Input: [ {
        name: 'enter_input',
        bindKey: { win: 'Enter', mac: 'Enter' },
        exec: input
    } ]
};

const tabs = {};
document.querySelectorAll( '#EditorTabs > :not(.tabSeparator)' )
    .forEach( element => {
        tabs[ element.innerText ] = element;
        element.addEventListener( 'click', tabHandler );
    } );

function sessionSwitch( name ) {
    tabs[ sessionName ].classList.remove( 'active' );
    editor.commands.removeCommands( commands[ sessionName ] ?? [] );

    tabs[ name ].classList.add( 'active' );
    editor.setSession( sessions[ name ] );

    editor.setReadOnly( readOnlySessions[ name ] ?? false );
    editor.commands.addCommands( commands[ name ] ?? [] );

    sessionName = name;

    if ( !readOnlySessions[ name ] )
        editor.focus();
}
window.sessionSwitch = sessionSwitch;

function tabHandler( event ) {
    if ( event.target.classList.contains( 'active' ) )
        return;

    sessionSwitch( event.target.innerText );
}

// -- Switch to the default session --

sessionSwitch( sessionName );

// -- Get and set the code from outside --

function setCode( code ) {
    sessionSwitch( 'Editor' );
    editor.setValue( code );
}
window.setCode = setCode;

function getCode() {
    return sessions.Editor.getValue();
}
window.getCode = getCode;

// -- Parse the code from the editor --

function parse( editor ) {
    const text = editor.getValue()

    const result = window.parse( text );

    if ( result !== true ) {
        const line_number = window.wasm.get_error_location();

        editor.getSession().setAnnotations( [ {
            row: line_number - 1,
            column: 0,
            text: result,
            type: "error"
        } ] );

        return false;
    }

    return true;
}

// -- Assemble the parsed code --

function assemble( editor ) {
    const result = window.assemble();

    if ( result !== true ) {
        editor.getSession().setAnnotations( [ {
            row: 0,
            column: 0,
            text: result,
            type: "error"
        } ] );

        return false;
    }

    return true;
}

// -- Run the computer --

function run() {
    let char_sequence_newline = '';

    while ( true ) {
        const state = window.wasm.step();

        switch ( state ) {
            case 0:
                break;

            case 1:
                editor.insert( `${ char_sequence_newline }[Awaiting input]\n` );
                readOnlySessions.Input = false;

                return;

            case 2:
                const result = window.wasm.output();
                if ( result === 1000 ) {
                    editor.insert( `${ char_sequence_newline }[Error while getting computer output!]\n` );

                    return;
                }

                editor.insert( `${ char_sequence_newline }${ result }\n` );
                char_sequence_newline = '';

                break;

            case 3:
                editor.insert( `${ char_sequence_newline }[Halted]\n` );

                return;

            case 4:
                editor.insert( `${ char_sequence_newline }[Reached end of memory]\n` );

                return;

            case 5:
                editor.insert( `${ char_sequence_newline }[Reached an invalid instruction!]\n` );

                return;

            case 11:
                editor.insert( `${ char_sequence_newline }[Awaiting char input]\n` );
                readOnlySessions.Input = false;

                return;

            case 12:
                let output = String.fromCharCode( window.wasm.output_char() );
                editor.insert( output );

                char_sequence_newline = output === '\n' ? '' : '\n';

                break;

            default:
                editor.insert( `${ char_sequence_newline }[Reached an invalid state: ${ state }\n]` );

                return;
        }
    }
}

// -- Take inputs --

function input( editor ) {
    const value = editor.getValue();
    const state = window.wasm.get_state();
    let number;

    switch ( state ) {
        case 1:
            number = parseInt( value );
            if ( isNaN( number ) ) {
                console.error( 'Parse input failed!' );
                editor.getSession().setAnnotations( [ {
                    row: 0,
                    column: 0,
                    text: 'Invalid number!',
                    type: 'error'
                } ] );

                return;
            }

            window.wasm.input( number );

            break;

        case 11:
            if ( value.length !== 1 ) {
                console.error( value.length === 0 ? 'No input characters!' : 'Multiple input characters!' );
                editor.getSession().setAnnotations( [ {
                    row: 0,
                    column: 0,
                    text: value.length === 0 ? 'No characters!' : 'Multiple characters!',
                    type: 'error'
                } ] );

                return;
            }

            number = value.charCodeAt( 0 );

            window.wasm.input_char( number );

            break;

        default:
            console.error( `Computer is not expecting an input (state: ${ state })!` );
            editor.getSession().setAnnotations( [ {
                row: 0,
                column: 0,
                text: `Computer is not expecting an input (state: ${ state })!`,
                type: 'error'
            } ] );

            return;
    }

    readOnlySessions.Input = true;
    editor.setValue( '' );

    sessionSwitch( 'Output' );
    editor.insert( `> ${ value }\n` );

    run();
}

// -- Parse, assemble and run the code in the editor --

function execute( editor ) {
    if ( !parse( editor ) )
        return;

    if ( !assemble( editor ) )
        return;

    sessionSwitch( 'Output' );
    editor.setValue( '' );

    window.wasm.initialise();
    run();
}
window.execute = execute;

// -- Add the options --

document.querySelectorAll( '#Options input' )
    .forEach( input => input.addEventListener( 'change', optionHandle ) );

function optionHandle( event ) {
    editor[ event.target.name ]( event.target.checked );
}

// -- Add the instructions text --

const runShortcut = editor.commands.platform === 'mac' ? 'Cmd + Enter' : 'Ctrl + Enter';

const instructions = document.getElementById( 'Instructions' );
instructions.innerText = `Press [${ runShortcut }] to run the code`;
