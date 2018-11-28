////////////////////////////// Bit Constants //////////////////////////////

const BIT0 = 0x01;
const BIT1 = 0x02;
const BIT2 = 0x04;
const BIT3 = 0x08;
const BIT4 = 0x10;
const BIT5 = 0x20;
const BIT6 = 0x40;
const BIT7 = 0x80;

const BIT8 = 0x0100;
const BIT9 = 0x0200;
const BIT10 = 0x0400;
const BIT11 = 0x0800;
const BIT12 = 0x1000;
const BIT13 = 0x2000;
const BIT14 = 0x4000;
const BIT15 = 0x8000;

const NOT_BIT0 = 0xfe;
const NOT_BIT1 = 0xfd;
const NOT_BIT2 = 0xfb;
const NOT_BIT3 = 0xf7;
const NOT_BIT4 = 0xef;
const NOT_BIT5 = 0xdf;
const NOT_BIT6 = 0xbf;
const NOT_BIT7 = 0x7f;

////////////////////////////// SMS Constants //////////////////////////////

//const SMS_CYCLES_PER_FRAME = 60000; // FIXME - not accurate.
//const SMS_CORE_CLOCK_CYCLES_PER_FRAME = 894887;
const SMS_CORE_CLOCK_CYCLES_PER_FRAME = 896040;

////////////////////////////// CPU Constants //////////////////////////////

const CPU_FLAG_C = 0x01;
const CPU_FLAG_N = 0x02;
const CPU_FLAG_PV = 0x04;
const CPU_FLAG_F3 = 0x08;
const CPU_FLAG_H = 0x10;
const CPU_FLAG_F5 = 0x20;
const CPU_FLAG_Z = 0x40;
const CPU_FLAG_S = 0x80;

////////////////////////////// MMC Constants //////////////////////////////

const MMC_SYSTEM_RAM_SIZE = 0x2000; // 8KB of system RAM.
const MMC_MAX_ROM_BANKS = 64;
const MMC_ROM_BANK_SIZE = 0x4000; // 16KB per ROM bank.

////////////////////////////// VDP Constants //////////////////////////////

const VDP_VRAM_RAM_SIZE = 0x4000; // 16KB VRAM.
const VDP_CRAM_RAM_SIZE = 0x20; // 32 bytes CRAM.

const VDP_DISPLAY_MODE_UNKNOWN = 0;
const VDP_DISPLAY_MODE_4 = 4;

//const VDP_LINE_MODE_UNKNOWN = 0;
const VDP_LINE_MODE_192 = 1;
//const VDP_LINE_MODE_224 = 1;
//const VDP_LINE_MODE_240 = 2;

const VDP_SCANLINE_COUNT_NTSC = 262;
const VDP_VISIBLE_SCANLINE_COUNT_NTSC = 192;
const VDP_CYCLES_PER_SCANLINE_NTSC = 228;

const VDP_CONTROL_CODE_READWRITE_VRAM = 0;
const VDP_CONTROL_CODE_ENABLE_DATA_PORT_VRAM_WRITES = 1;
const VDP_CONTROL_CODE_WRITE_REGISTER = 2;
const VDP_CONTROL_CODE_ENABLE_DATA_PORT_CRAM_WRITES = 3;

const VDP_REGISTER_INDEX_MODE_CONTROL_1 = 0;
const VDP_REGISTER_INDEX_MODE_CONTROL_2 = 1;
const VDP_REGISTER_INDEX_NAME_TABLE_BASE_ADDRESS = 2;
const VDP_REGISTER_INDEX_COLOR_TABLE_BASE_ADDRESS = 3;
const VDP_REGISTER_INDEX_BACKGROUND_PATTERN_GENERATOR_BASE_ADDRESS = 4;
const VDP_REGISTER_INDEX_SPRITE_ATTRIBUTE_TABLE_BASE_ADDRESS = 5;
const VDP_REGISTER_INDEX_SPRITE_PATTERN_GENERATOR_BASE_ADDRESS = 6;
const VDP_REGISTER_INDEX_OVERSCAN_COLOUR = 7;
const VDP_REGISTER_INDEX_BACKGROUND_X_SCROLL = 8;
const VDP_REGISTER_INDEX_BACKGROUND_Y_SCROLL = 9;
const VDP_REGISTER_INDEX_LINE_COUNTER = 10;

const VDP_DATA_PORT_WRITE_MODE_VRAM = 1;
const VDP_DATA_PORT_WRITE_MODE_CRAM = 2;

////////////////////////////// Joypads Constants //////////////////////////////

const INPUT_PORT_AB = 0;
const INPUT_PORT_BMISC = 1;

const INPUT_BUTTON_COUNT = 6;

const INPUT_JOYPAD_BUTTON_UP = 0;
const INPUT_JOYPAD_BUTTON_DOWN = 1;
const INPUT_JOYPAD_BUTTON_LEFT = 2;
const INPUT_JOYPAD_BUTTON_RIGHT = 3;
const INPUT_JOYPAD_BUTTON_TRIGGER_LEFT = 4;
const INPUT_JOYPAD_BUTTON_TRIGGER_RIGHT = 5;

const INPUT_KEYCODE_UP = 38;
const INPUT_KEYCODE_DOWN = 40;
const INPUT_KEYCODE_LEFT = 37;
const INPUT_KEYCODE_RIGHT = 39;
const INPUT_KEYCODE_Z = 90;
const INPUT_KEYCODE_X = 88;

const INPUT_KEYSTATE_UP = 0;
const INPUT_KEYSTATE_DOWN = 1;

////////////////////////////// Audio Constants //////////////////////////////

const AUDIO_LATCHTYPE_TONENOISE = 0;
const AUDIO_LATCHTYPE_VOLUME = 1;