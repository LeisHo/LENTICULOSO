// ====================================================================
// presets.mjs — built-in printer and paper presets (pure data + helpers)
// ====================================================================
// Researched 2026-09-23. Evidence per field:
//   SOURCED  — from the manufacturer page/spec sheet or a retailer
//              listing found in that research (URL in `sources`)
//   INFERRED — reasoning, not a published spec (said so in `notes`)
//   null     — not found; never filled with a guess
//
// WHY 720 DPI FOR EVERY EPSON PRESET. Epson inkjet drivers accept image
// data at 720 ppi (360 ppi in lower-quality modes) and resample anything
// else to it (SOURCED: DPReview "Epson printers and native resolution"
// threads; Jim Kasson's Epson inkjet series). For lenticular printing a
// driver resample is exactly what must NOT happen — it re-grids the
// strips and smears the pitch — so an Epson preset builds the image at
// 720 DPI. The "5760 × 1440 dpi" marketing figure is ink-droplet
// placement, not the resolution the image should be built at.
// ====================================================================

const EPSON_NATIVE_NOTE = 'Epson drivers work at 720 ppi (360 in draft/standard modes); build at 720 and print at the driver\'s High/Best quality with the matching paper type.';

const CANON_NATIVE_NOTE = 'Canon drivers are widely reported to work at 300 ppi, or 600 ppi at the highest quality (practitioner-reported, not a Canon spec); build at 600. Specs gathered from search results for Canon\u2019s product pages \u2014 verify anything critical.';
const HP_NATIVE_NOTE = 'HP does not publish a native input resolution; its datasheets only name 1200 input dpi for "Max dpi" mode. 600 ppi is the common working value, so presets build at 600 (300/600/1200 all avoid an awkward resample).';

/** Printer presets (Epson, Canon, HP). `dpi` = resolution to BUILD the image at. */
export const PRINTER_PRESETS = [
    {
        id: 'epson-et-2400', brand: 'Epson', model: 'EcoTank ET-2400', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: '4 × 6 in only',
        ink: '4-colour dye (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE + ' Borderless only at 4 × 6 in.',
        sources: ['https://epson.com/For-Home/Printers/Inkjet/EcoTank-ET-2400-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scan-and-Copy/p/C11CJ67201'],
    },
    {
        id: 'epson-et-2800', brand: 'Epson', model: 'EcoTank ET-2800 / ET-2803', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'yes (photo sizes)',
        ink: '4-colour dye (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/8c4e4113f8c005b7307586975f40d8e66ec236cf/original?assetDescr=EcoTank_ET-2800_White_Printer_Specification_Sheet_CPD-61360.pdf'],
    },
    {
        id: 'epson-et-2850', brand: 'Epson', model: 'EcoTank ET-2850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 1200 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'yes (photo sizes)',
        ink: '4-colour (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE + ' Same engine class as the ET-2800, adds auto 2-sided.',
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-ET-2850-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scan%2C-Copy-and-Auto-2-sided-Printing/p/C11CJ63202'],
    },
    {
        id: 'epson-et-3850', brand: 'Epson', model: 'EcoTank ET-3850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 1200 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'only with specific paper types/sizes',
        ink: '4-colour (black ink type not verified)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-ET-3850-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scanner,-Copier,-ADF-and-Ethernet/p/C11CJ61201'],
    },
    {
        id: 'epson-et-4800', brand: 'Epson', model: 'EcoTank ET-4800', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 11 in (Letter/A4)', borderless: null,
        ink: '4-colour dye (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/af25b196110b25c9e71dc3a68789e724ba826ff3/original?assetDescr=EcoTank_ET-4800_Printer_Specification_Sheet_CPD-60630R1.pdf'],
    },
    {
        id: 'epson-et-4850', brand: 'Epson', model: 'EcoTank ET-4850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: null, maxSheet: '8.5 × 14 in (Legal)', borderless: null,
        ink: '4-colour (black ink type not verified)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-ET-4850-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scanner,-Copier,-Fax,-ADF-and-Ethernet/p/C11CJ60202'],
    },
    {
        id: 'epson-et-5850', brand: 'Epson', model: 'EcoTank Pro ET-5850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 2400 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'up to 8.5 × 14 in',
        ink: 'pigment (DURABrite)',
        notes: EPSON_NATIVE_NOTE + ' Office model with pigment ink (INFERRED, not tested: pigment can sit on glossy coatings — if prints smudge, try semi-gloss).',
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-Pro-ET-5850-All-in-One-Cartridge-Free-Supertank-Printer/p/C11CJ29201'],
    },
    {
        id: 'epson-et-8500', brand: 'Epson', model: 'EcoTank Photo ET-8500', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 11 in (Letter/A4)', borderless: '4 × 6 in to 8.5 × 11 in',
        ink: '6-colour Claria ET Premium (photo)',
        notes: EPSON_NATIVE_NOTE + ' Photo model — the best-suited EcoTank for lenticular prints up to A4.',
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/7c77763356f8444ea6190abf8c8577bf8f365680/original?assetDescr=EcoTank-ET-8500_Printer-Specification-Sheet_CPD-59931R2-Final.pdf',
            'https://www.redrivercatalog.com/infocenter/epson-et-8550-et-8500-insiders-guide.html'],
    },
    {
        id: 'epson-et-8550', brand: 'Epson', model: 'EcoTank Photo ET-8550', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '13 × 19 in (A3+)', borderless: '3.5 × 5 in to 13 × 19 in',
        ink: '6-colour Claria ET Premium (photo)',
        notes: EPSON_NATIVE_NOTE + ' Photo model with A3+ — prints a lens-sized A4 sheet with room to spare.',
        sources: ['https://www.bhphotovideo.com/c/product/1639048-REG/epson_c11cj21201_ecotank_et_8550_all_in_one_printer.html',
            'https://www.redrivercatalog.com/infocenter/epson-et-8550-et-8500-insiders-guide.html'],
    },
    {
        id: 'epson-et-15000', brand: 'Epson', model: 'EcoTank ET-15000', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 1200 dpi', maxSheet: '13 × 19 in (A3+)', borderless: null,
        ink: '4-colour (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/b1cddd21fa0893f3d85680baf08cc586f8e85d37/original?assetDescr=EcoTank_ET-15000_Specification_Sheet_CPD-58551R2.pdf'],
    },
    {
        id: "epson-et-2980", brand: "Epson", model: "EcoTank ET-2980", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in (Legal)", borderless: "4×6, 5×7, 8×10 in, A4, Letter",
        ink: "4 bottles (CMYK), 502 ink",
        notes: EPSON_NATIVE_NOTE,
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/0ab0016b1abb5d194981c75bfff13fed3d94da02/original?assetDescr=EcoTank_ET-2980_Printer_Spec_Sheet_BW_CPD-65308R1.pdf", "https://files.support.epson.com/docid/cpd6/cpd64024.pdf"],
    },
    {
        id: "epson-et-3830", brand: "Epson", model: "EcoTank ET-3830", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in cassette; 8.5 × 47.2 in user-defined", borderless: "4×6, 5×7, 8×10 in, A4, Letter",
        ink: "4 bottles (CMYK), 502 ink; pigment black",
        notes: EPSON_NATIVE_NOTE,
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/f52b30bbee6fd2ef116133b65de56bd8dbd6b503/original?assetDescr=EcoTank_ET-3830_Printer_Specification_Sheet_CPD-60632R1.pdf", "https://files.support.epson.com/docid/cpd6/cpd60208.pdf"],
    },
    {
        id: "epson-et-4950", brand: "Epson", model: "EcoTank ET-4950", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in (Legal)", borderless: "up to 8.5 × 11 in",
        ink: "4 bottles (CMYK), 502 ink",
        notes: EPSON_NATIVE_NOTE,
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/ede874046278ef1d31a435e0beaaf2f9966c9dec/original?assetDescr=EcoTank_ET-4950_Printer_Specification_Sheet_BW_CPD-65615R1+Final.pdf"],
    },
    {
        id: "epson-et-7750", brand: "Epson", model: "Expression Premium ET-7750 (EcoTank, wide-format)", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "5760 × 1440 optimized dpi", maxSheet: "11.7 × 44 in", borderless: "5×7, 8×10 in, Letter, A4 (photo tray)",
        ink: "5 bottles incl. photo black, 512 ink",
        notes: EPSON_NATIVE_NOTE + ' Older (2017) 5-colour photo EcoTank.',
        sources: ["https://www.multivu.com/players/English/7820755-epson-ecotank-cartridge-free-printers/docs/et7750specsheet-1505844041265-2047082461.pdf", "https://epson.com/For-Work/Printers/Inkjet/Expression-Premium-ET-7750-EcoTank-Wide-format-All-in-One-Supertank-Printer/p/C11CG16201"],
    },
    {
        id: "epson-xp-4200", brand: "Epson", model: "Expression Home XP-4200", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "5760 × 1440 dpi", maxSheet: "Legal; 8.5 × 47.2 in user-defined", borderless: "Letter, A4, 8×10, 5×7, 4×6 in",
        ink: "4 cartridges (CMYK), Claria 232",
        notes: EPSON_NATIVE_NOTE,
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/0c9bf8b6087e325f40dd3d72cb0e54b068dd46c9/original?assetDescr=Expression_Home_XP-4200_Printer_Specification_Sheet_CPD-62071R1.pdf"],
    },
    {
        id: "epson-xp-5200", brand: "Epson", model: "Expression Home XP-5200", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 47.2 in user-defined", borderless: "Letter, A4, 8×10, 5×7, 4×6, 3.5×5 in",
        ink: "4 cartridges (CMYK), Claria 222",
        notes: EPSON_NATIVE_NOTE,
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/2bd590c49f197c66f97321e2610c64adbc7f2261/original?assetDescr=Expression_Home_XP-5200_Printer_Specification_Sheet_CPD-62069.pdf"],
    },
    {
        id: "epson-xp-8700", brand: "Epson", model: "Expression Photo XP-8700", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "5760 × 1440 dpi", maxSheet: "8.5 × 47.2 in", borderless: "Letter/A4 max",
        ink: "6-colour Claria Photo HD",
        notes: EPSON_NATIVE_NOTE + ' 6-colour photo model.',
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/af36852974d0b613d7a55caf95e03782f5e23206/original?assetDescr=Expression_Photo_XP-8700_Printer_Specification_Sheet_CPD-61309R1.pdf"],
    },
    {
        id: "epson-xp-15000", brand: "Epson", model: "Expression Photo HD XP-15000", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "5760 × 1440 optimized dpi", maxSheet: "13 × 44 in", borderless: "4×6 in up to 13 × 19 in",
        ink: "6-colour Claria Photo HD (incl. grey, red)",
        notes: EPSON_NATIVE_NOTE + ' Older (2017) 6-colour A3+ photo model.',
        sources: ["https://files.bbystatic.com/2u%2FCBfHTvhsvov5U%2Bf1hDA==/77feb675-46af-4b91-ac93-236b4192f67c.pdf"],
    },
    {
        id: "epson-sc-p700", brand: "Epson", model: "SureColor P700", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "5760 × 1440 dpi", maxSheet: "13 × 19 in sheet; 13 in roll", borderless: "3.5×5 in up to 13 × 19 in",
        ink: "10-colour UltraChrome PRO10 pigment",
        notes: EPSON_NATIVE_NOTE + ' Prosumer desktop photo printer; pigment ink.',
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/7213f1717e9992f679dd28dd65b080caa256df70/original?assetDescr=SureColor_P700_Printer_Specification_Sheet_CPD-58515R4.pdf"],
    },
    {
        id: "epson-sc-p900", brand: "Epson", model: "SureColor P900", dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: "5760 × 1440 dpi", maxSheet: "17 × 22 in sheet", borderless: "3.5×5 in up to 17 × 22 in",
        ink: "10-colour UltraChrome PRO10 pigment",
        notes: EPSON_NATIVE_NOTE + ' Prosumer desktop photo printer (17 in); pigment ink.',
        sources: ["https://mediaserver.goepson.com/ImConvServlet/imconv/47b3354a7a9e4992e78f8759e8ee45e94f797854/original?assetDescr=SureColor_P900_Printer_Specification_Sheet_CPD-58527R3.pdf"],
    },
    {
        id: "canon-g620", brand: "Canon", model: "PIXMA G620 (MegaTank)", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in (Legal)", borderless: "up to 8.5 × 11 in",
        ink: "6-colour dye (incl. red, grey)",
        notes: CANON_NATIVE_NOTE + ' 6-colour photo MegaTank.',
        sources: ["https://www.usa.canon.com/shop/p/pixma-g620"],
    },
    {
        id: "canon-g3270", brand: "Canon", model: "PIXMA G3270 (MegaTank)", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in (Legal)", borderless: "up to 8.5 × 11 in",
        ink: "pigment black + dye colour",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.usa.canon.com/shop/p/pixma-g3270"],
    },
    {
        id: "canon-g4270", brand: "Canon", model: "PIXMA G4270 (MegaTank)", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: null, borderless: "up to 8.5 × 11 in",
        ink: "pigment black + dye colour",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.shi.com/product/46209498/Canon-PIXMA-G4270-MegaTank"],
    },
    {
        id: "canon-g6020", brand: "Canon", model: "PIXMA G6020 (MegaTank)", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in", borderless: "up to 8.5 × 11 in",
        ink: "pigment black + dye colour",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.usa.canon.com/shop/p/pixma-g6020"],
    },
    {
        id: "canon-g7020", brand: "Canon", model: "PIXMA G7020 (MegaTank)", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in", borderless: "yes (max size not stated)",
        ink: "pigment black + dye colour",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.bhphotovideo.com/c/product/1525708-REG/canon_3114c002_pixma_g7020_wireless_megatank.html"],
    },
    {
        id: "canon-ts6420a", brand: "Canon", model: "PIXMA TS6420a", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "8.5 × 14 in (Legal)", borderless: "yes (sizes not stated)",
        ink: "PG-260 black + CL-261 colour cartridges",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.bhphotovideo.com/c/product/1698884-REG/canon_4462c082aa_pixma_ts6420a_wireless_inkjet.html"],
    },
    {
        id: "canon-ts8820", brand: "Canon", model: "PIXMA TS8820", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: null, borderless: "up to 8.5 × 11 in",
        ink: "6 individual inks",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.usa.canon.com/shop/p/pixma-ts8820"],
    },
    {
        id: "canon-ts9521c", brand: "Canon", model: "PIXMA TS9521C (Crafter’s)", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 1200 dpi", maxSheet: "12 × 12 in", borderless: "up to 12 × 12 in",
        ink: "5 individual inks (ChromaLife100)",
        notes: CANON_NATIVE_NOTE,
        sources: ["https://www.usa.canon.com/newsroom/2018/20180807-craft"],
    },
    {
        id: "canon-pro-200", brand: "Canon", model: "PIXMA PRO-200", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 2400 dpi", maxSheet: "13 × 19 in", borderless: "up to 13 × 19 in",
        ink: "8-colour dye",
        notes: CANON_NATIVE_NOTE + ' Prosumer desktop photo printer.',
        sources: ["https://www.bhphotovideo.com/c/product/1602503-REG/canon_4280c002_pixma_pro_200.html"],
    },
    {
        id: "canon-pro-300", brand: "Canon", model: "imagePROGRAF PRO-300", dpi: 600, nativeDpi: [300, 600],
        maxPrintResolution: "4800 × 2400 dpi", maxSheet: "13 × 19 in (A3+)", borderless: "yes (max size not confirmed)",
        ink: "10-cartridge LUCIA PRO pigment",
        notes: CANON_NATIVE_NOTE + ' Prosumer desktop photo printer; pigment ink.',
        sources: ["https://www.usa.canon.com/shop/p/imageprograf-pro-300"],
    },
    {
        id: "hp-envy-6055e", brand: "HP", model: "ENVY 6055e", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 11.7 in custom max", borderless: "up to 8.5 × 11 in",
        ink: "2 cartridges (HP 67 black + tri-colour)",
        notes: HP_NATIVE_NOTE,
        sources: ["https://www.hp.com/content/dam/sites/garage-press/press/press-kits/2020/hp-empowers-learning/HP%20ENVY%206055%20All-In-One%20Printer.pdf"],
    },
    {
        id: "hp-envy-6455e", brand: "HP", model: "ENVY 6455e", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 14 in custom max", borderless: "up to 8.5 × 11 in",
        ink: "2 cartridges (black + tri-colour)",
        notes: HP_NATIVE_NOTE,
        sources: ["https://h20195.www2.hp.com/v2/getpdf.aspx/c08290994.pdf"],
    },
    {
        id: "hp-envy-inspire-7955e", brand: "HP", model: "ENVY Inspire 7955e", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "Legal (main tray); photo tray 5×5, 4×6, 5×7 in", borderless: "up to 8.5 × 11 in",
        ink: "2 cartridges (HP 64 black + tri-colour)",
        notes: HP_NATIVE_NOTE + ' Has a separate photo tray.',
        sources: ["https://files.bbystatic.com/NHGhZCjRYJMYXDCDrxrBUA==/Datasheet"],
    },
    {
        id: "hp-envy-photo-7855", brand: "HP", model: "ENVY Photo 7855", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "Legal", borderless: "up to 8.5 × 11 in",
        ink: "2 cartridges (black + tri-colour)",
        notes: HP_NATIVE_NOTE + ' Has a separate photo tray.',
        sources: ["https://media.flixcar.com/f360cdn/HP-2537556775-c05525775.pdf"],
    },
    {
        id: "hp-smart-tank-7602", brand: "HP", model: "Smart Tank 7602", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 14 in", borderless: "up to 8.5 × 11 in",
        ink: "4 ink bottles (HP 32XL black + HP 31 CMY)",
        notes: HP_NATIVE_NOTE,
        sources: ["https://h20195.www2.hp.com/v2/GetDocument.aspx?docname=c08191670"],
    },
    {
        id: "hp-smart-tank-7301", brand: "HP", model: "Smart Tank 7301", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 14 in", borderless: "up to 8.5 × 11 in",
        ink: null,
        notes: HP_NATIVE_NOTE,
        sources: ["https://www8.hp.com/h20195/v2/GetDocument.aspx?docname=c07857399"],
    },
    {
        id: "hp-smart-tank-plus-651", brand: "HP", model: "Smart Tank Plus 651", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 14 in", borderless: "up to 8.5 × 11 in",
        ink: null,
        notes: HP_NATIVE_NOTE,
        sources: ["https://www8.hp.com/h20195/v2/GetDocument.aspx?docname=c08783531"],
    },
    {
        id: "hp-officejet-pro-8025e", brand: "HP", model: "OfficeJet Pro 8025e", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 14 in", borderless: "photo paper only, up to 8.5 × 11 in",
        ink: "4 cartridges (CMYK)",
        notes: HP_NATIVE_NOTE,
        sources: ["https://h20195.www2.hp.com/v2/getpdf.aspx/c08859455.pdf"],
    },
    {
        id: "hp-officejet-pro-9015e", brand: "HP", model: "OfficeJet Pro 9015e", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "216 × 356 mm", borderless: "photo paper only, A4",
        ink: "4 cartridges (CMYK)",
        notes: HP_NATIVE_NOTE,
        sources: ["https://h20195.www2.hp.com/v2/GetPDF.aspx/c07055542.pdf"],
    },
    {
        id: "hp-deskjet-2755e", brand: "HP", model: "DeskJet 2755e", dpi: 600, nativeDpi: [300, 600, 1200],
        maxPrintResolution: "up to 4800 × 1200 optimized dpi (colour, best)", maxSheet: "8.5 × 14 in", borderless: "no",
        ink: "2 cartridges (black + tri-colour)",
        notes: HP_NATIVE_NOTE + ' No borderless printing.',
        sources: ["https://m.media-amazon.com/images/I/C1x93hrM+tL.pdf"],
    },
];

// ---- Paper ---------------------------------------------------------------
// What about paper matters for a lenticular print (INFERRED from the
// sources below unless marked):
//  1. COATING / FINISH — ink must stay where it is placed so each strip
//     (often 1.5–3 printer pixels wide) stays separate. Resin-coated
//     glossy photo paper holds ink in a microporous layer; plain paper
//     wicks it sideways and blurs strips into each other (ghosting).
//     SOURCED: eufymake lenticular guide ("premium glossy or resin coated
//     photo paper… regular paper absorbs too much ink, which can blur the
//     fine interlaced lines").
//  2. DIMENSIONAL STABILITY — plain paper swells where ink wets it
//     (cockle) and shrinks back unevenly; any stretch changes the
//     printed pitch, which is exactly what calibration measured. So a
//     calibration is only trustworthy on the paper it was done on.
//  3. DRIVER PAPER TYPE — the driver's media setting controls ink load
//     and print mode; it must match the paper actually loaded.
//  Thickness does NOT change the optics when the print sits behind the
//  lens (the lens focuses on its own back surface); it is recorded for
//  feeding/lamination only.
export const LENTICULAR_SUITABILITY = {
    best: 'Best — resin-coated glossy: sharpest strips, stable size',
    good: 'Good — resin-coated / semi-gloss: sharp, stable',
    fair: 'Fair — matte coated: softer strips, some ghosting',
    poor: 'Poor — plain paper: ink spreads and paper cockles',
};

export const PAPER_PRESETS = [
    // ---- Epson
    { id: 'epson-premium-glossy', brand: 'Epson', model: 'Premium Photo Paper Glossy', finish: 'glossy', base: 'resin-coated photo',
        gsm: 252, thicknessMil: 10.4, lenticular: 'best', driverSetting: 'Epson Premium Photo Paper Glossy',
        sources: ['https://epson.com/For-Home/Paper/Photo/Premium-Photo-Paper-Glossy/m/Epson%20Premium%20Photo%20Paper%20Glossy'] },
    { id: 'epson-photo-glossy', brand: 'Epson', model: 'Photo Paper Glossy (S041140 / S041141)', finish: 'glossy', base: 'photo',
        gsm: null, thicknessMil: 8.1, lenticular: 'good', driverSetting: 'Epson Photo Paper Glossy',
        sources: ['https://epson.com/For-Home/Paper/Photo/Photo-Paper-Glossy/m/S041140'] },
    { id: 'epson-premium-semigloss', brand: 'Epson', model: 'Premium Photo Paper Semi-gloss', finish: 'semi-gloss', base: 'resin-coated photo',
        gsm: 251, thicknessMil: 10.4, lenticular: 'good', driverSetting: 'Epson Premium Photo Paper Semi-Gloss',
        sources: ['https://epson.com/For-Work/Paper/Photo/Premium-Photo-Paper-Semi-gloss/m/Epson%20Premium%20Photo%20Paper%20Semi%20Gloss'] },
    { id: 'epson-presentation-matte', brand: 'Epson', model: 'Premium Presentation Paper Matte', finish: 'matte', base: 'coated matte',
        gsm: 165, thicknessMil: 9, lenticular: 'fair', driverSetting: 'Epson Premium Presentation Paper Matte',
        sources: ['https://epson.com/For-Work/Paper/Presentation/Premium-Presentation-Paper-Matte/m/Epson%20Premium%20Presentation%20Paper%20Matte'] },
    // ---- Canon
    { id: 'canon-pp201', brand: 'Canon', model: 'Photo Paper Plus Glossy II (PP-201)', finish: 'glossy', base: 'resin-coated photo',
        gsm: 265, thicknessMil: round1(0.27 / 0.0254), lenticular: 'best', driverSetting: null,
        sources: ['https://en.canon-cna.com/printers/inkjet/pixma/photo-paper/pp-201/specifications/'] },
    { id: 'canon-gp701', brand: 'Canon', model: 'Photo Paper Glossy (GP-701)', finish: 'glossy', base: 'photo',
        gsm: 200, thicknessMil: null, lenticular: 'good', driverSetting: null,
        sources: ['https://www.bhphotovideo.com/c/product/1301347-REG/canon_1433c004_glossy_photo_paper.html'] },
    { id: 'canon-sg201', brand: 'Canon', model: 'Photo Paper Plus Semi-gloss (SG-201)', finish: 'semi-gloss', base: 'resin-coated photo',
        gsm: 260, thicknessMil: 10.2, lenticular: 'good', driverSetting: null,
        sources: ['https://www.bhphotovideo.com/c/product/830262-REG/Canon_1686B063_Photo_Paper_Plus_Semi_Gloss.html'] },
    { id: 'canon-mp101', brand: 'Canon', model: 'Matte Photo Paper (MP-101)', finish: 'matte', base: 'coated matte',
        gsm: 170, thicknessMil: null, lenticular: 'fair', driverSetting: null,
        sources: ['https://en.canon-me.com/printers/inkjet/pixma/photo-paper/mp-101/specifications/'] },
    // ---- HP
    { id: 'hp-premium-plus-glossy', brand: 'HP', model: 'Premium Plus Photo Paper Glossy', finish: 'glossy', base: 'resin-coated photo',
        gsm: 280, thicknessMil: 11.5, lenticular: 'best', driverSetting: null,
        sources: ['https://www.hp.com/us-en/shop/pdp/hp-premium-plus-photo-paper--glossy-50-sheets--85-x-11-cr664a'] },
    { id: 'hp-advanced-glossy', brand: 'HP', model: 'Advanced Photo Paper Glossy', finish: 'glossy', base: 'photo',
        gsm: 250, thicknessMil: 10.5, lenticular: 'best', driverSetting: null,
        sources: ['https://support.hp.com/lv-en/document/c00406621'] },
    { id: 'hp-everyday-glossy', brand: 'HP', model: 'Everyday Photo Paper Glossy', finish: 'glossy', base: 'photo',
        gsm: 200, thicknessMil: round1(0.2 / 0.0254), lenticular: 'good', driverSetting: null,
        sources: ['https://www.hp.com/us-en/shop/pdp/hp-everyday-photo-paper--glossy--50-sheets--85-x-11-inch-q8723a'] },
    { id: 'hp-presentation-matte', brand: 'HP', model: 'Premium Presentation Paper Matte (120 g)', finish: 'matte', base: 'coated matte',
        gsm: 120, thicknessMil: null, lenticular: 'fair', driverSetting: null,
        sources: ['https://www.bhphotovideo.com/c/product/470444-REG/HP_Hewlett_Packard_Q5449A_Premium_Presentation_Paper_Matte.html'] },
    // ---- added 2026-09-23 (second research pass)
    { id: "epson-ultra-premium-glossy", brand: "Epson", model: "Ultra Premium Photo Paper Glossy", finish: "glossy", base: "resin-coated photo", gsm: null, thicknessMil: 11.8, lenticular: "best", driverSetting: "Ultra Premium Photo Paper Glossy", notes: "Weight not published by Epson (79 lb basis); retailers disagree (297 vs 305 g/m²).", sources: ["https://epson.com/For-Home/Paper/Photo/Ultra-Premium-Photo-Paper-Glossy/m/Epson%20Ultra%20Premium%20Photo%20Paper%20Glossy"] },
    { id: "epson-ultra-premium-luster", brand: "Epson", model: "Ultra Premium Photo Paper Luster", finish: "luster", base: "resin-coated photo", gsm: 240, thicknessMil: 10, lenticular: "good", driverSetting: "Ultra Premium Photo Paper Luster", notes: null, sources: ["https://epson.com/For-Home/Paper/Photo/Ultra-Premium-Photo-Paper-Luster/m/S041405"] },
    { id: "epson-value-glossy", brand: "Epson", model: "Value Photo Paper Glossy", finish: "glossy", base: "photo", gsm: 186, thicknessMil: 9.1, lenticular: "good", driverSetting: "Epson Premium Photo Paper Glossy", notes: "Epson guide maps it to the Premium Photo Paper Glossy setting. Some sizes listed as discontinued.", sources: ["https://epson.com/For-Home/Paper/Photo/Value-Photo-Paper-Glossy/m/Epson%20Value%20Photo%20Paper%20Glossy"] },
    { id: "epson-velvet-fine-art", brand: "Epson", model: "Velvet Fine Art Paper", finish: "matte", base: "cotton rag (fine art)", gsm: 260, thicknessMil: 19, lenticular: "fair", driverSetting: "Velvet Fine Art Paper", notes: "Textured matte art paper: soft strips.", sources: ["https://epson.com/For-Work/Paper/Pro-Imaging/Velvet-Fine-Art-Paper/m/Epson%20Velvet%20Fine%20Art%20Paper"] },
    { id: "epson-ultra-presentation-matte", brand: "Epson", model: "Ultra Premium Presentation Paper Matte", finish: "matte", base: "coated matte", gsm: 192, thicknessMil: 10.3, lenticular: "fair", driverSetting: null, notes: "Weight from a retailer; thickness from Epson.", sources: ["https://epson.com/For-Work/Paper/Presentation/Ultra-Premium-Presentation-Paper-Matte/m/Epson%20Ultra%20Premium%20Presentation%20Paper%20Matte"] },
    { id: "epson-presentation-matte-s041062", brand: "Epson", model: "Presentation Paper Matte (S041062)", finish: "matte", base: "coated matte", gsm: 102, thicknessMil: 4.9, lenticular: "fair", driverSetting: "Presentation Paper Matte", notes: null, sources: ["https://epson.com/For-Home/Paper/Presentation/Presentation-Paper-Matte/m/S041062"] },
    { id: "epson-presentation-matte-2s", brand: "Epson", model: "Premium Presentation Paper Matte Double-sided (S041568)", finish: "matte", base: "coated matte", gsm: 165, thicknessMil: 9, lenticular: "fair", driverSetting: "Premium Presentation Paper Matte", notes: null, sources: ["https://epson.com/For-Work/Paper/Presentation/Premium-Presentation-Paper-Matte/m/S041568"] },
    { id: "epson-brochure-matte", brand: "Epson", model: "Brochure & Flyer Paper Matte, double-sided (S042384)", finish: "matte", base: "coated matte", gsm: 179, thicknessMil: 9.8, lenticular: "fair", driverSetting: null, notes: null, sources: ["https://epson.com/For-Work/Paper/Presentation/Brochure-&-Flyer-Paper-Matte/m/S042384"] },
    { id: "epson-self-adhesive", brand: "Epson", model: "Photo Quality Self-adhesive Sheets (S041106)", finish: "matte", base: "coated, adhesive-backed", gsm: 167, thicknessMil: 7.5, lenticular: "fair", driverSetting: "Plain Paper/Bright White Paper", notes: "Figures from a retailer. Adhesive back could mount directly to a lens backing.", sources: ["https://www.imageprointernational.com/products/epson-photo-quality-self-adhesive-sheets-a4-8-3-x-11-7-10-sheets"] },
    { id: "epson-bright-white", brand: "Epson", model: "Bright White Pro Paper (S041586)", finish: "plain", base: "uncoated", gsm: 90, thicknessMil: 4.3, lenticular: "poor", driverSetting: "Plain Paper / Bright White Paper", notes: "Everyday text printing.", sources: ["https://epson.com/For-Work/Paper/Copy-and-Printer-Paper/Bright-White-Pro-Paper/m/S041586"] },
    { id: "canon-pt101", brand: "Canon", model: "Photo Paper Pro Platinum (PT-101)", finish: "glossy", base: "photo (heavyweight)", gsm: 300, thicknessMil: 11.8, lenticular: "best", driverSetting: null, notes: null, sources: ["https://en.canon-cna.com/printers/inkjet/pixma/photo-paper/pt-101/specifications/"] },
    { id: "canon-lu101", brand: "Canon", model: "Photo Paper Pro Luster (LU-101)", finish: "luster", base: "resin-coated photo", gsm: 260, thicknessMil: 10.2, lenticular: "good", driverSetting: null, notes: "Some retailers list 255 g/m²; Canon Europe lists 260.", sources: ["https://www.canon-europe.com/printers/inkjet/pixma/photo-paper/lu-101/specifications/"] },
    { id: "canon-gp501", brand: "Canon", model: "Everyday Use Glossy Photo Paper (GP-501)", finish: "glossy", base: "photo", gsm: 200, thicknessMil: 8.3, lenticular: "good", driverSetting: null, notes: "Europe/Asia; thickness converted from the published 0.21 mm.", sources: ["https://www.canon.co.uk/printers/inkjet/pixma/photo-paper/gp-501/specifications/"] },
    { id: "canon-mg101", brand: "Canon", model: "Magnetic Photo Paper (MG-101)", finish: "glossy", base: "photo, magnetic back", gsm: 670, thicknessMil: 13.0, lenticular: "good", driverSetting: null, notes: "4 × 6 in only; weight includes the magnet.", sources: ["https://www.canon-europe.com/printers/inkjet/pixma/photo-paper/magnetic_photo_paper_mg-101/specifications/"] },
    { id: "canon-pm101", brand: "Canon", model: "Photo Paper Pro Premium Matte (PM-101)", finish: "matte", base: "coated matte", gsm: 210, thicknessMil: 12.2, lenticular: "fair", driverSetting: null, notes: null, sources: ["https://en.canon-cna.com/printers/inkjet/pixma/photo-paper/pm-101/specifications/"] },
    { id: "canon-mp101d", brand: "Canon", model: "Double-sided Matte Paper (MP-101D)", finish: "matte", base: "coated matte", gsm: 240, thicknessMil: 10.8, lenticular: "fair", driverSetting: null, notes: "Thickness converted from the published 0.275 mm.", sources: ["https://www.canon.co.uk/printers/inkjet/pixma/photo-paper/double-sided-matte-paper-mp-101d/specifications/"] },
    { id: "canon-rp101", brand: "Canon", model: "Restickable Photo Paper (RP-101)", finish: "matte", base: "photo, adhesive back", gsm: 260, thicknessMil: 10.6, lenticular: "fair", driverSetting: null, notes: "4 × 6 in only. Matte finish per a retailer listing.", sources: ["https://www.canon.co.uk/printers/inkjet/pixma/photo-paper/restickable_photo_paper_rp-101/specifications/"] },
    { id: "canon-hr101n", brand: "Canon", model: "High Resolution Paper (HR-101N)", finish: "matte", base: "coated (not photo)", gsm: 106, thicknessMil: 4.8, lenticular: "fair", driverSetting: null, notes: "Everyday coated paper for text/graphics; thickness converted from 0.122 mm.", sources: ["https://www.canon.co.uk/printers/inkjet/pixma/photo-paper/hr-101n/specifications/"] },
    { id: "canon-red-label", brand: "Canon", model: "Red Label Superior (80 g/m²)", finish: "plain", base: "uncoated", gsm: 80, thicknessMil: null, lenticular: "poor", driverSetting: "Plain Paper", notes: "Everyday text printing (Europe/UK).", sources: ["https://www.canon.co.uk/store/canon-red-label-superior-fsc-80-g-m-a4-paper-500-sheets/6246B009/"] },
    { id: "canon-black-label", brand: "Canon", model: "Black Label Zero (80 g/m²)", finish: "plain", base: "uncoated", gsm: 80, thicknessMil: 4.2, lenticular: "poor", driverSetting: "Plain Paper", notes: "Everyday text printing (Europe/UK); thickness converted from the published 107 µm.", sources: ["https://mediaguide.cpp.canon/ResultDetails.aspx?ArticleGroupID=566"] },
    { id: "hp-premium-plus-softgloss", brand: "HP", model: "Premium Plus Photo Paper Soft-gloss (CR667A)", finish: "semi-gloss", base: "photo", gsm: 300, thicknessMil: 11.5, lenticular: "good", driverSetting: null, notes: "HP 2011 guide says 300 g/m²; current retailers say 280.", sources: ["http://www.hp.com/sbso/product/supplies/paper-guide.pdf"] },
    { id: "hp-glossy-brochure", brand: "HP", model: "Inkjet Glossy Brochure Paper 180 g (Q1987A)", finish: "glossy", base: "coated, two-sided", gsm: 180, thicknessMil: null, lenticular: "good", driverSetting: null, notes: null, sources: ["https://www.hp.com/us-en/shop/pdp/hp-inkjet-glossy-brochure-paper-180-gsm-150-sht-letter-85-x-11-in"] },
    { id: "hp-trifold-glossy", brand: "HP", model: "Tri-fold Brochure Paper 180 g Glossy (C7020A)", finish: "glossy", base: "coated", gsm: 180, thicknessMil: null, lenticular: "good", driverSetting: null, notes: "From HP’s 2011 paper guide; may be discontinued.", sources: ["http://www.hp.com/sbso/product/supplies/paper-guide.pdf"] },
    { id: "hp-premium-photo-matte", brand: "HP", model: "Premium Photo Paper Matte (Q6563A)", finish: "matte", base: "coated matte", gsm: 240, thicknessMil: 10, lenticular: "fair", driverSetting: null, notes: "From HP’s 2011 paper guide; may be discontinued.", sources: ["http://www.hp.com/sbso/product/supplies/paper-guide.pdf"] },
    { id: "hp-everyday-matte", brand: "HP", model: "Everyday Photo Paper Matte (C7007A)", finish: "matte", base: "coated matte", gsm: 125, thicknessMil: 6, lenticular: "fair", driverSetting: null, notes: "From HP’s 2011 paper guide; may be discontinued.", sources: ["http://www.hp.com/sbso/product/supplies/paper-guide.pdf"] },
    { id: "hp-matte-brochure", brand: "HP", model: "Inkjet Matte Brochure Paper 180 g (CH016A)", finish: "matte", base: "coated, two-sided", gsm: 180, thicknessMil: null, lenticular: "fair", driverSetting: null, notes: null, sources: ["https://www.hp.com/us-en/shop/pdp/hp-inkjet-matte-brochure-paper-180-gsm-150-sht-letter-85-x-11-in"] },
    { id: "hp-premium32", brand: "HP", model: "Premium32 Printer Paper (32 lb)", finish: "plain", base: "uncoated", gsm: 120, thicknessMil: null, lenticular: "poor", driverSetting: "Plain Paper", notes: "Everyday text printing. HP Papers licensed brand. Thickness (5.2 mil) seen only in a search summary, so not recorded.", sources: ["https://www.amazon.com/HP-Printer-Paper-Premium32-Letter/dp/B000099O2W"] },
    { id: "hp-brightwhite24", brand: "HP", model: "BrightWhite24 Inkjet Paper (24 lb)", finish: "plain", base: "uncoated", gsm: 90, thicknessMil: null, lenticular: "poor", driverSetting: "Plain Paper", notes: "Everyday text printing. A 4.7 mil thickness appears in a search summary but may belong to a different HP roll product, so not recorded.", sources: ["https://www.hp.com/us-en/shop/pdp/hp-bright-white-inkjet-paper-500-sht-letter-85-x-11-in-hpb1124p"] },
    { id: "hp-multipurpose20", brand: "HP", model: "Printer Paper MultiPurpose20 (20 lb)", finish: "plain", base: "uncoated", gsm: 75, thicknessMil: null, lenticular: "poor", driverSetting: "Plain Paper", notes: "Everyday text printing.", sources: ["https://www.amazon.com/HP-Printer-Paper-Multipurpose20-112000R/dp/B00005UKAX"] },
    // ---- plain (text printing)
    { id: 'plain-copy', brand: 'Any', model: 'Plain copy / printer paper (75–90 g)', finish: 'plain', base: 'uncoated',
        gsm: null, thicknessMil: null, lenticular: 'poor', driverSetting: 'Plain Paper',
        sources: ['https://www.eufymake.com/blogs/printing-guides/lenticular-printing'] },
];

/**
 * Which "Paper Type" to choose in the printer driver for this paper on a
 * printer of `printerBrand` (Epson / Canon / HP). Each brand's driver
 * lists only its own media names, so a paper of another brand gets the
 * closest own-brand type by finish (INFERRED: matched by finish, not a
 * published cross-brand table). Same-brand paper → its own name.
 */
const CLOSEST_MEDIA = {
    Epson: { glossy: 'Epson Premium Photo Paper Glossy', 'semi-gloss': 'Epson Premium Photo Paper Semi-Gloss', luster: 'Epson Ultra Premium Photo Paper Luster', matte: 'Epson Premium Presentation Paper Matte', plain: 'Plain Paper' },
    Canon: { glossy: 'Photo Paper Plus Glossy II', 'semi-gloss': 'Photo Paper Plus Semi-gloss', luster: 'Photo Paper Pro Luster', matte: 'Matte Photo Paper', plain: 'Plain Paper' },
    HP: { glossy: 'HP Advanced Photo Papers', 'semi-gloss': 'HP Advanced Photo Papers', luster: 'HP Advanced Photo Papers', matte: 'HP Premium Presentation Paper, Matte', plain: 'Plain Paper' },
};
export function driverSettingFor(paper, printerBrand = 'Epson') {
    if (!paper) return null;
    const brand = CLOSEST_MEDIA[printerBrand] ? printerBrand : 'Epson';
    if (paper.brand === brand && paper.driverSetting) return paper.driverSetting;
    if (paper.brand === brand && paper.finish !== 'plain') return `${paper.brand} ${paper.model}`;
    const m = CLOSEST_MEDIA[brand][paper.finish];
    if (!m) return null;
    return paper.finish === 'plain' ? m : `${m} (closest match)`;
}
/** Back-compat alias (Epson printers). */
export function epsonDriverSettingFor(paper) { return driverSettingFor(paper, 'Epson'); }

/** Brand of a printer object (preset or a saved profile started from one). */
export function printerBrandOf(printer) {
    if (!printer) return null;
    if (printer.brand) return printer.brand;
    const p = printer.presetId && PRINTER_PRESETS.find(x => x.id === printer.presetId);
    if (p) return p.brand;
    const m = /\b(Epson|Canon|HP)\b/i.exec(`${printer.name} ${printer.model || ''}`);
    return m ? { epson: 'Epson', canon: 'Canon', hp: 'HP' }[m[1].toLowerCase()] : null;
}

export const PRINTER_BRANDS = ['Epson', 'Canon', 'HP'];

export function thicknessUm(paper) {
    return paper && paper.thicknessMil != null ? Math.round(paper.thicknessMil * 25.4) : null;
}

// ---- selection helpers ---------------------------------------------------
// A <select> value is either a saved profile id or "preset:<presetId>".
export const PRESET_PREFIX = 'preset:';

export function printerFromPreset(p) {
    return {
        kind: 'printer', id: PRESET_PREFIX + p.id, preset: true, presetId: p.id,
        name: `${p.brand} ${p.model}`, model: `${p.brand} ${p.model}`, dpi: p.dpi, nativeDpi: p.nativeDpi,
        media: '', notes: p.notes, brand: p.brand,
    };
}

export function paperFromPreset(p) {
    return { ...p, kind: 'paper', id: PRESET_PREFIX + p.id, preset: true, presetId: p.id, name: `${p.brand} ${p.model}` };
}

/** Resolve a select value to a printer object (saved profile or preset), or null. */
export function resolvePrinter(value, store) {
    if (!value) return null;
    if (value.startsWith(PRESET_PREFIX)) {
        const p = PRINTER_PRESETS.find(x => x.id === value.slice(PRESET_PREFIX.length));
        return p ? printerFromPreset(p) : null;
    }
    return store ? store.get(value) : null;
}

export function resolvePaper(value, store) {
    if (!value) return null;
    if (value.startsWith(PRESET_PREFIX)) {
        const p = PAPER_PRESETS.find(x => x.id === value.slice(PRESET_PREFIX.length));
        return p ? paperFromPreset(p) : null;
    }
    return store ? store.get(value) : null;
}

/** Native input resolutions for a printer object (preset or saved profile made from one). */
export function nativeDpiOf(printer) {
    if (!printer) return null;
    if (printer.nativeDpi) return printer.nativeDpi;
    const p = printer.presetId && PRINTER_PRESETS.find(x => x.id === printer.presetId);
    return p ? p.nativeDpi : null;
}

function round1(v) { return Math.round(v * 10) / 10; }
