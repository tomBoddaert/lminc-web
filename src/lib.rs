#![cfg_attr(not(test), no_std)]
#![no_main]

#![warn(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    clippy::perf,
    clippy::cargo
)]

use core::{fmt::Write, ptr::addr_of, slice};

use lminc::{
    assembler::assemble_from_parser,
    computer::{self, Computer, Memory},
    num3::ThreeDigitNumber,
    parser::Parser,
};
use string_writer::StringWriter;

mod string_writer;

extern "C" {
    static __heap_base: u8;
}

static mut HEAP_POINTER: *mut u8 = unsafe { addr_of!(__heap_base).cast_mut() };

#[cfg(not(test))]
mod panic {
    use core::{arch::wasm32::unreachable, panic::PanicInfo};

    #[panic_handler]
    fn panic(_info: &PanicInfo) -> ! {
        // Reaching an unreachable in WASM causes a trap,
        //  which immediately aborts execution
        unreachable()
    }
}

static mut CODE: &str =
    unsafe { core::str::from_utf8_unchecked(slice::from_raw_parts(HEAP_POINTER, 0)) };

static mut PARSER: Parser = Parser::new();

static mut ASSEMBLED: Memory = [ThreeDigitNumber::ZERO; 100];

static mut COMPUTER: Computer = Computer::new(unsafe { ASSEMBLED });

static mut ERROR_LOCATION: usize = 0;
static mut ERROR_LENGTH: usize = 0;

#[no_mangle]
pub extern "C" fn get_code_base() -> *mut u8 {
    unsafe { HEAP_POINTER }
}

#[no_mangle]
/// # Safety
/// Caller must ensure that the memory from the base pointer for the length set
/// is a valid utf-8 string
pub unsafe extern "C" fn set_code_length(length: usize) {
    ERROR_LENGTH = 0;
    CODE = core::str::from_utf8_unchecked(slice::from_raw_parts(HEAP_POINTER, length));
}

#[no_mangle]
pub extern "C" fn get_error_length() -> usize {
    unsafe { ERROR_LENGTH }
}

#[no_mangle]
pub extern "C" fn get_error_location() -> usize {
    unsafe { ERROR_LOCATION }
}

#[no_mangle]
pub extern "C" fn parse() -> usize {
    unsafe {
        match Parser::parse_text(CODE) {
            Ok(parser) => {
                PARSER = parser;
                0
            }
            Err(error) => {
                ERROR_LOCATION = error.0 .0;

                let mut writer = StringWriter::new(HEAP_POINTER.add(CODE.len()));
                write!(&mut writer, "{error}").unwrap();
                ERROR_LENGTH = writer.length;
                writer.base as usize
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn assemble() -> usize {
    unsafe {
        match assemble_from_parser(PARSER) {
            Ok(memory) => {
                ASSEMBLED = memory;
                0
            }
            Err(error) => {
                ERROR_LOCATION = error.0 .0;

                let mut writer = StringWriter::new(HEAP_POINTER.add(CODE.len()));
                write!(&mut writer, "{error}").unwrap();
                ERROR_LENGTH = writer.length;
                writer.base as usize
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn initialise() {
    unsafe { COMPUTER = Computer::new(ASSEMBLED) };
}

#[repr(u32)]
pub enum State {
    Running = 0,
    AwaitingInput = 1,
    AwaitingOutput = 2,
    #[cfg(feature = "extended")]
    AwaitingCharInput = 11,
    #[cfg(feature = "extended")]
    AwaitingCharOutput = 12,
    Halted = 3,
    ReachedEnd = 4,
    InvalidInstruction = 5,
}

impl From<computer::State> for State {
    fn from(value: computer::State) -> Self {
        match value {
            computer::State::Running => Self::Running,
            computer::State::AwaitingInput => Self::AwaitingInput,
            computer::State::AwaitingOutput => Self::AwaitingOutput,
            #[cfg(feature = "extended")]
            computer::State::AwaitingCharInput => Self::AwaitingCharInput,
            #[cfg(feature = "extended")]
            computer::State::AwaitingCharOutput => Self::AwaitingCharOutput,
            computer::State::Halted => Self::Halted,
            computer::State::ReachedEnd => Self::ReachedEnd,
            computer::State::InvalidInstruction => Self::InvalidInstruction,
        }
    }
}

#[no_mangle]
pub extern "C" fn get_state() -> u32 {
    unsafe { State::from(COMPUTER.state()) as u32 }
}

#[no_mangle]
pub extern "C" fn step() -> u32 {
    State::from(unsafe { COMPUTER.step() }) as u32
}

#[no_mangle]
/// # Safety
/// Caller should ensure that the value is in the range (0..=999)
pub unsafe extern "C" fn input(value: u16) -> bool {
    COMPUTER.input(ThreeDigitNumber::from_unchecked(value)).is_ok()
}

#[no_mangle]
pub extern "C" fn output() -> u32 {
    unsafe {
        u16::from(
            COMPUTER
                .output()
                .unwrap_or(ThreeDigitNumber::from_unchecked(1000)),
        )
        .into()
    }
}

#[cfg(feature = "extended")]
#[no_mangle]
/// # Safety
/// Caller must ensure that the value is in the range (0..=999)
pub unsafe extern "C" fn input_char(value: u16) -> bool {
    COMPUTER.input_char(ThreeDigitNumber::from_unchecked(value)).is_ok()
}

#[cfg(feature = "extended")]
#[no_mangle]
pub extern "C" fn output_char() -> u32 {
    unsafe {
        u16::from(
            COMPUTER
                .output_char()
                .unwrap_or(ThreeDigitNumber::from_unchecked(0)),
        )
        .into()
    }
}
