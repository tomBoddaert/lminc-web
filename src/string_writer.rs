use core::{
    fmt::{Result, Write},
    slice,
};

pub struct StringWriter {
    pub base: *mut u8,
    pub length: usize,
}

impl StringWriter {
    #[must_use]
    pub const unsafe fn new(base: *mut u8) -> Self {
        Self { base, length: 0 }
    }
}

impl Write for StringWriter {
    fn write_char(&mut self, c: char) -> Result {
        let buffer = unsafe { slice::from_raw_parts_mut(self.base.add(self.length), 4) };

        let length = c.encode_utf8(buffer).len();
        self.length += length;

        Ok(())
    }

    fn write_str(&mut self, s: &str) -> Result {
        s.chars().try_for_each(|c| self.write_char(c))
    }
}
