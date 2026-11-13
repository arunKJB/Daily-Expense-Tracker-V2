/* =========================================================
   VOICE.JS - MULTIPLE EXPENSE PARSER
   Tamil + English + Hindi + Telugu + Malayalam
   Quantity + Units + Editable Table
   (creator is locked to the logged-in user)
========================================================= */

(function () {
    "use strict";

    const $ = id => document.getElementById(id);

    let recognition = null;
    let listening = false;
    let manualStop = false;
    let finalTranscript = "";
    let interimTranscript = "";
    let restartTimer = null;
    let previewItems = [];
    let isSaving = false;

    /* =====================================================
       NUMBER WORDS
    ===================================================== */

    const TAMIL_NUMBERS = {
        "பூஜ்ஜியம்": 0, "பூஜ்யம்": 0, "சுழியம்": 0,
        "ஒன்று": 1, "ஒரு": 1, "ரெண்டு": 2, "இரண்டு": 2,
        "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5, "அஞ்சு": 5,
        "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9,
        "பத்து": 10, "பதினொன்று": 11, "பன்னிரண்டு": 12,
        "பதிமூன்று": 13, "பதினான்கு": 14, "பதினைந்து": 15,
        "பதினாறு": 16, "பதினேழு": 17, "பதினெட்டு": 18,
        "பத்தொன்பது": 19, "இருபது": 20, "முப்பது": 30,
        "நாற்பது": 40, "ஐம்பது": 50, "அம்பது": 50,
        "அறுபது": 60, "எழுபது": 70, "எண்பது": 80,
        "தொண்ணூறு": 90, "நூறு": 100, "நூற்றி": 100,
        "இருநூறு": 200, "முன்னூறு": 300, "நானூறு": 400,
        "ஐநூறு": 500, "ஐந்நூறு": 500, "அறுநூறு": 600,
        "எழுநூறு": 700, "எண்ணூறு": 800, "தொள்ளாயிரம்": 900,
        "ஆயிரம்": 1000, "இரண்டாயிரம்": 2000,
        "மூவாயிரம்": 3000, "நான்காயிரம்": 4000,
        "ஐயாயிரம்": 5000
    };

    const OTHER_NUMBERS = {
        "zero": 0, "one": 1, "a": 1, "an": 1,
        "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9,
        "ten": 10, "eleven": 11, "twelve": 12,
        "thirteen": 13, "fourteen": 14, "fifteen": 15,
        "sixteen": 16, "seventeen": 17, "eighteen": 18,
        "nineteen": 19, "twenty": 20, "thirty": 30,
        "forty": 40, "fifty": 50, "sixty": 60,
        "seventy": 70, "eighty": 80, "ninety": 90,
        "hundred": 100, "thousand": 1000
    };

    const HINDI_NUMBERS = {
        "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4,
        "पांच": 5, "पाँच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9,
        "दस": 10, "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14,
        "पंद्रह": 15, "पन्द्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19,
        "बीस": 20, "पच्चीस": 25, "तीस": 30, "चालीस": 40, "पचास": 50,
        "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90,
        "सौ": 100, "हजार": 1000, "हज़ार": 1000
    };

    const TELUGU_NUMBERS = {
        "సున్నా": 0, "ఒకటి": 1, "ఒక": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4,
        "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9,
        "పది": 10, "పదకొండు": 11, "పన్నెండు": 12, "పదిహేను": 15,
        "ఇరవై": 20, "ముప్పై": 30, "నలభై": 40, "యాభై": 50,
        "అరవై": 60, "డెబ్బై": 70, "ఎనభై": 80, "తొంభై": 90,
        "వంద": 100, "వెయ్యి": 1000
    };

    const MALAYALAM_NUMBERS = {
        "പൂജ്യം": 0, "ഒന്ന്": 1, "ഒരു": 1, "രണ്ട്": 2, "മൂന്ന്": 3, "നാല്": 4,
        "അഞ്ച്": 5, "ആറ്": 6, "ഏഴ്": 7, "എട്ട്": 8, "ഒമ്പത്": 9, "ഒൻപത്": 9,
        "പത്ത്": 10, "ഇരുപത്": 20, "മുപ്പത്": 30, "നാല്പത്": 40, "അമ്പത്": 50,
        "അറുപത്": 60, "എഴുപത്": 70, "എൺപത്": 80, "തൊണ്ണൂറ്": 90,
        "നൂറ്": 100, "ആയിരം": 1000
    };

    Object.assign(OTHER_NUMBERS, HINDI_NUMBERS, TELUGU_NUMBERS, MALAYALAM_NUMBERS);

    const ALL_NUMBER_WORDS = [
        ...Object.keys(TAMIL_NUMBERS),
        ...Object.keys(OTHER_NUMBERS)
    ].sort((a, b) => b.length - a.length);

    const NUMBER_WORD_PATTERN = ALL_NUMBER_WORDS
        .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

    // "not inside a word" checks that also work for Indic scripts
    const LB = "(?<![\\p{L}\\p{M}\\p{N}])";
    const LA = "(?![\\p{L}\\p{M}\\p{N}])";

    // FIX: number WORDS must be whole words. Before, the English word "a"
    // matched inside words ("pizza Rs 50" was read as "a Rs" = 1 rupee).
    const NUMBER_PATTERN =
        `(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?|${LB}(?:${NUMBER_WORD_PATTERN})${LA}(?:\\s+(?:${NUMBER_WORD_PATTERN})${LA})*)`;

    /* =====================================================
       DIGIT NORMALIZATION
    ===================================================== */

    function normalizeDigits(text) {
        const maps = [
            [0x0966, 0x096F],
            [0x0BE6, 0x0BEF],
            [0x0C66, 0x0C6F],
            [0x0D66, 0x0D6F]
        ];

        return String(text || "").replace(
            /[\u0966-\u096F\u0BE6-\u0BEF\u0C66-\u0C6F\u0D66-\u0D6F]/g,
            character => {
                const code = character.charCodeAt(0);

                for (const [start, end] of maps) {
                    if (code >= start && code <= end) {
                        return String(code - start);
                    }
                }

                return character;
            }
        );
    }

    /* =====================================================
       WORD TO NUMBER CONVERSION
    ===================================================== */

    function wordNumberValue(words) {
        const cleaned = String(words || "").trim().toLowerCase();

        if (!cleaned) return null;

        const numeric = cleaned.replace(/,/g, "");

        if (/^\d+(?:\.\d+)?$/.test(numeric)) {
            return Number(numeric);
        }

        if (TAMIL_NUMBERS[cleaned] !== undefined) {
            return TAMIL_NUMBERS[cleaned];
        }

        if (OTHER_NUMBERS[cleaned] !== undefined) {
            return OTHER_NUMBERS[cleaned];
        }

        const tokens = cleaned.split(/\s+/).filter(Boolean);

        let total = 0;
        let current = 0;
        let found = false;

        for (const token of tokens) {

            const value =
                TAMIL_NUMBERS[token] !== undefined
                    ? TAMIL_NUMBERS[token]
                    : OTHER_NUMBERS[token];

            if (value === undefined) return null;

            found = true;

            if (value === 1000) {
                total += (current || 1) * 1000;
                current = 0;
            } else if (value === 100) {
                current = (current || 1) * 100;
            } else {
                current += value;
            }
        }

        return found ? total + current : null;
    }

    function convertAmount(value) {
        return wordNumberValue(
            normalizeDigits(value).replace(/,/g, "").toLowerCase()
        );
    }

    /* =====================================================
       CURRENCY AMOUNT REGEX
    ===================================================== */

    const CURRENCY_PATTERN =
        "(?:ரூபாய்கள்|ரூபாய்|ரூபா|ரூப|रुपये|रुपए|रुपया|రూపాయలు|రూపాయి|രൂപ|(?:rupees?|rs\\.?|inr)(?![\\p{L}\\p{N}]))";

    const SUFFIX_AMOUNT_REGEX = new RegExp(
        `(${NUMBER_PATTERN})\\s*${CURRENCY_PATTERN}`,
        "giu"
    );

    const PREFIX_AMOUNT_REGEX = new RegExp(
        `(?:₹|${LB}(?:rs\\.?|inr))\\s*(${NUMBER_PATTERN})`,
        "giu"
    );

    /* =====================================================
       DESCRIPTION CLEANING
    ===================================================== */

    function cleanDescription(description, creatorName = "") {

        let result = String(description || "");

        if (creatorName) {
            const escaped = creatorName.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            result = result.replace(
                new RegExp(escaped, "gi"),
                " "
            );
        }

        result = result
            .replace(
                /\b(today|yesterday|expense|expenses|spent|spend|paid|pay|amount|for|on|and|also|then|i|we|my)\b/gi,
                " "
            )
            .replace(/\b(rupees?|rupee|rs\.?|inr)\b/gi, " ")
            .replace(/^(மற்றும்|அதற்கு|பிறகு|இன்று|நேற்று|நான்|और|तथा|फिर)\s*/i, "")
            .replace(/[,:;.!?]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return result;
    }

    /* =====================================================
       QUANTITY + UNIT EXTRACTION

       Works in English, Tamil, Hindi, Telugu, Malayalam.

       10 kg tomato 200 rupees      -> quantity 10, "tomato (kg)"
       tomato 2 kgs 80 rupees       -> quantity 2,  "tomato (kg)"
       ஒரு கிலோ தக்காளி 80 ரூபாய்     -> quantity 1,  "தக்காளி (kg)"
       அரை கிலோ பால் 30 ரூபாய்        -> quantity 0.5
       two and a half kg onion 150  -> quantity 2.5
       10 किलो आलू 200 रुपये          -> quantity 10
       3 tea 60 rupees              -> quantity 3 (no unit)

       If nothing is detected, quantity = 1.
    ===================================================== */

    const FRACTION_WORDS = {
        "half": 0.5, "a half": 0.5, "quarter": 0.25, "a quarter": 0.25,
        "three quarters": 0.75, "one and a half": 1.5,
        "அரை": 0.5, "கால்": 0.25, "முக்கால்": 0.75,
        "ஒன்றரை": 1.5, "இரண்டரை": 2.5, "மூன்றரை": 3.5,
        "आधा": 0.5, "आधी": 0.5, "आधे": 0.5, "पाव": 0.25, "पौन": 0.75,
        "सवा": 1.25, "डेढ़": 1.5, "डे\u095D": 1.5, "डेढ": 1.5, "ढाई": 2.5, "ढा\u0908": 2.5,
        "అర": 0.5, "పావు": 0.25, "ఒకటిన్నర": 1.5, "రెండున్నర": 2.5,
        "അര": 0.5, "കാൽ": 0.25, "മുക്കാൽ": 0.75, "ഒന്നര": 1.5, "രണ്ടര": 2.5
    };

    const UNIT_ALIASES = {
        "kg": ["kilograms", "kilogram", "kilos", "kilo", "kgs", "kg",
               "கிலோகிராம்", "கிலோ", "கி.கி", "किलोग्राम", "किलो",
               "కిలోగ్రాము", "కిలోగ్రాం", "కిలో", "കിലോഗ്രാം", "കിലോ"],
        "g": ["grams", "gram", "gms", "gm", "g", "கிராம்", "ग्राम", "గ్రాము", "గ్రాం", "ഗ്രാം"],
        "litre": ["litres", "litre", "liters", "liter", "ltrs", "ltr",
                  "லிட்டர்", "लीटर", "లీటర్", "లీటరు", "ലിറ്റർ"],
        "ml": ["millilitres", "millilitre", "milliliters", "milliliter", "ml", "மில்லி", "मिलीलीटर", "మిల్లీ"],
        "pcs": ["pieces", "piece", "pcs", "pc", "nos", "numbers", "number",
                "பீஸ்", "துண்டு", "எண்ணம்", "नग", "पीस", "टुकड़ा", "ముక్క", "పీస్", "കഷ്ണം", "പീസ്"],
        "dozen": ["dozens", "dozen", "டஜன்", "दर्जन", "డజను", "ഡസൻ"],
        "packet": ["packets", "packet", "packs", "pack", "பாக்கெட்", "पैकेट", "ప్యాకెట్", "പാക്കറ്റ്"],
        "bag": ["bags", "bag", "sacks", "sack", "மூட்டை", "बोरी", "బస్తా", "ചാക്ക്"],
        "box": ["boxes", "box", "பெட்டி", "डिब्बा", "बॉक्स", "బాక్స్", "ബോക്സ്"],
        "bottle": ["bottles", "bottle", "பாட்டில்", "बोतल", "సీసా", "బాటిల్", "കുപ്പി", "ബോട്ടിൽ"],
        "cup": ["cups", "cup", "கப்", "कप"],
        "plate": ["plates", "plate", "பிளேட்", "प्लेट"],
        "meter": ["meters", "metres", "metre", "meter", "மீட்டர்", "मीटर"],
        "bundle": ["bundles", "bundle", "கட்டு", "गट्ठर"]
    };

    const UNIT_LOOKUP = {};

    for (const [label, aliases] of Object.entries(UNIT_ALIASES)) {
        for (const alias of aliases) {
            UNIT_LOOKUP[alias.toLowerCase()] = label;
        }
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const UNIT_PATTERN = Object.keys(UNIT_LOOKUP)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex)
        .join("|");

    const FRACTION_PATTERN = Object.keys(FRACTION_WORDS)
        .sort((a, b) => b.length - a.length)
        .map(word => escapeRegex(word).replace(/ /g, "\\s+"))
        .join("|");

    const DIGIT_NUMBER =
        "(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";

    const WORD_NUMBER =
        `${LB}(?:${NUMBER_WORD_PATTERN})${LA}(?:\\s+(?:${NUMBER_WORD_PATTERN})${LA})*`;

    const NUMBER_QUANTITY =
        `(?:${DIGIT_NUMBER}|${WORD_NUMBER})(?:\\s+and\\s+(?:a\\s+)?(?:half|quarter))?`;

    // number/fraction + unit, anywhere in the text
    const INLINE_QUANTITY_REGEX = new RegExp(
        `${LB}(${FRACTION_PATTERN}|${NUMBER_QUANTITY})\\s*(${UNIT_PATTERN})${LA}`,
        "iu"
    );

    // plain number at the very start (no unit): "3 tea"
    const LEADING_QUANTITY_REGEX = new RegExp(
        `^(${NUMBER_QUANTITY})\\s+`,
        "iu"
    );

    function parseQuantityText(raw) {

        let text = normalizeDigits(raw)
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        let extra = 0;

        const tail = text.match(/\s*and\s+(?:a\s+)?(half|quarter)$/);

        if (tail) {
            extra = tail[1] === "half" ? 0.5 : 0.25;
            text = text.slice(0, tail.index).trim();
        }

        if (FRACTION_WORDS[text] !== undefined) {
            return FRACTION_WORDS[text];
        }

        const base = wordNumberValue(text);

        if (base === null || !Number.isFinite(base)) return null;

        return Number((base + extra).toFixed(3));
    }

    function extractQuantityWithUnit(text) {

        const match = INLINE_QUANTITY_REGEX.exec(text);

        if (!match) return null;

        const quantity = parseQuantityText(match[1]);

        if (quantity === null || !(quantity > 0)) return null;

        const unit = UNIT_LOOKUP[match[2].toLowerCase()] || "";

        const rest = (
            text.slice(0, match.index) +
            " " +
            text.slice(match.index + match[0].length)
        ).replace(/\s+/g, " ").trim();

        return { quantity, unit, rest };
    }

    function extractLeadingQuantity(description) {

        const text = String(description || "").trim();
        const match = text.match(LEADING_QUANTITY_REGEX);

        if (!match) {
            return { quantity: 1, description: text };
        }

        const quantity = parseQuantityText(match[1]);

        if (quantity === null || !(quantity > 0)) {
            return { quantity: 1, description: text };
        }

        return {
            quantity,
            description: text.slice(match[0].length).trim()
        };
    }

    /* =====================================================
       EXTRACT MULTIPLE EXPENSES
    ===================================================== */

    function extractExpenses(originalText, creatorName = "") {

        const text = normalizeDigits(originalText)
            .replace(/\s+/g, " ")
            .trim();

        const matches = [];

        for (const match of text.matchAll(SUFFIX_AMOUNT_REGEX)) {

            const amount = convertAmount(match[1]);

            if (amount === null || amount <= 0) continue;

            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                amount
            });
        }

        for (const match of text.matchAll(PREFIX_AMOUNT_REGEX)) {

            const amount = convertAmount(match[1]);

            if (amount === null || amount <= 0) continue;

            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                amount
            });
        }

        matches.sort((a, b) => a.start - b.start);

        const uniqueMatches = [];

        for (const match of matches) {

            const duplicate = uniqueMatches.some(existing =>
                match.start < existing.end &&
                existing.start < match.end
            );

            if (!duplicate) {
                uniqueMatches.push(match);
            }
        }

        const expenses = [];
        let previousEnd = 0;

        for (const match of uniqueMatches) {

            const raw = text.slice(previousEnd, match.start);
            previousEnd = match.end;

            // 1) quantity with a unit anywhere:
            //    "10 kg tomato", "tomato 2 kg", "ஒரு கிலோ தக்காளி"
            const withUnit = extractQuantityWithUnit(raw);

            let quantity = 1;
            let unit = "";
            let description = raw;

            if (withUnit) {
                quantity = withUnit.quantity;
                unit = withUnit.unit;
                description = withUnit.rest;
            }

            description = cleanDescription(description, creatorName)
                .replace(/^of\s+/i, "")
                .trim();

            // 2) plain leading count without a unit: "3 tea", "மூன்று டீ"
            if (!withUnit) {
                const leading = extractLeadingQuantity(description);
                quantity = leading.quantity;
                description = cleanDescription(leading.description, creatorName);
            }

            // description is optional: an amount alone is still a valid expense
            if (unit) description = description ? `${description} (${unit})` : `(${unit})`;

            expenses.push({
                comment: description,
                quantity,
                amount: Number(match.amount.toFixed(2)),
                expense_type: "",
                category: ""
            });
        }

        return expenses;
    }

    /* =====================================================
       DATE DETECTION
    ===================================================== */

    // FIX: "कल" / "आज" / "today" must be whole words
    // (before, a word like "कलम" was treated as "yesterday").
    const YESTERDAY_REGEX = new RegExp(
        `${LB}(?:yesterday${LA}|நேற்று|நேத்து|నిన్న|ഇന്നലെ|कल${LA})`,
        "iu"
    );

    const TODAY_REGEX = new RegExp(
        `${LB}(?:today${LA}|இன்று|இன்னைக்கு|இன்னிக்கு|आज${LA}|ఈరోజు|ഇന്ന്)`,
        "iu"
    );

    function detectDate(text) {

        const date = new Date();

        if (YESTERDAY_REGEX.test(text)) {
            date.setDate(date.getDate() - 1);
            return ymd(date);
        }

        if (TODAY_REGEX.test(text)) {
            return ymd(date);
        }

        return null;
    }

    /* =====================================================
       CLASSIFICATION RULES
    ===================================================== */

    const RULES = [
        {
            words: ["முட்டைகோஸ்", "cabbage", "கோஸ்"],
            category: "Other",
            typeKeywords: ["food", "grocery", "vegetable"]
        },
        {
            words: ["பீட்ரூட்", "beetroot"],
            category: "Other",
            typeKeywords: ["food", "grocery", "vegetable"]
        },
        {
            words: ["முள்ளங்கி", "radish"],
            category: "Other",
            typeKeywords: ["food", "grocery", "vegetable"]
        },
        {
            words: ["முருங்கைக்காய்", "drumstick"],
            category: "Other",
            typeKeywords: ["food", "grocery", "vegetable"]
        },
        {
            words: ["சப்பாத்தி", "chapati", "roti"],
            category: "Other",
            typeKeywords: ["food", "grocery"]
        },
        {
            words: ["பால்", "milk"],
            category: "Other",
            typeKeywords: ["food", "grocery"]
        },
        {
            words: ["பிஸ்கட்", "biscuit"],
            category: "Other",
            typeKeywords: ["food", "grocery"]
        },
        {
            words: ["இட்லி", "தோசை", "breakfast", "tiffin", "idli", "dosa"],
            category: "Breakfast",
            typeKeywords: ["food"]
        },
        {
            words: ["lunch", "மதிய உணவு", "meals"],
            category: "Lunch",
            typeKeywords: ["food"]
        },
        {
            words: ["dinner", "இரவு உணவு"],
            category: "Dinner",
            typeKeywords: ["food"]
        },
        {
            words: ["tea", "coffee", "டீ", "காபி"],
            category: "Other",
            typeKeywords: ["food", "snacks"]
        },
        {
            words: ["petrol", "diesel", "fuel", "பெட்ரோல்", "டீசல்"],
            category: "Transport",
            typeKeywords: ["fuel", "travel", "transport"]
        },
        {
            words: ["bus", "auto", "taxi", "cab", "பஸ்", "ஆட்டோ"],
            category: "Transport",
            typeKeywords: ["travel", "transport"]
        },
        {
            words: ["hotel", "room", "lodge", "stay"],
            category: "Accommodation",
            typeKeywords: ["hotel", "accommodation"]
        },
        {
            words: ["plumber", "pipe", "குழாய்", "பிளம்பர்"],
            category: "Plumbing Things",
            typeKeywords: ["house", "maintenance"]
        },
        {
            words: ["mesthiry", "mason", "மேஸ்திரி"],
            category: "Mesthiry",
            typeKeywords: ["house", "maintenance"]
        },
        {
            words: ["electricity", "current bill", "மின்சாரம்"],
            category: "Electric Things",
            typeKeywords: ["electricity", "house"]
        }
    ];

    // FIX: English keywords match whole words only
    // ("tea" no longer matches "steak", "bus" no longer matches "business").
    // Tamil / other scripts keep the simple "contains" match.
    function wordInText(lower, word) {

        const w = word.toLowerCase();

        if (/^[a-z ]+$/.test(w)) {
            return new RegExp(
                `(?<![a-z])${escapeRegex(w)}(?:s|es)?(?![a-z])`
            ).test(lower);
        }

        return lower.includes(w);
    }

    function detectClassification(description) {

        const lower = description.toLowerCase();

        const rule = RULES.find(item =>
            item.words.some(word => wordInText(lower, word))
        );

        if (!rule) {
            return {
                expense_type: "",
                category: ""
            };
        }

        const categorySelect = $("category");
        const typeSelect = $("expenseType");

        const category = categorySelect
            ? [...categorySelect.options].find(option =>
                option.value.toLowerCase() === rule.category.toLowerCase()
            )?.value || ""
            : "";

        const availableTypes = typeSelect
            ? [...typeSelect.options].map(option => option.value)
            : [];

        let expenseType = "";

        for (const keyword of rule.typeKeywords) {

            const found = availableTypes.find(type =>
                type.toLowerCase().includes(keyword)
            );

            if (found) {
                expenseType = found;
                break;
            }
        }

        return {
            expense_type: expenseType,
            category
        };
    }

    /* =====================================================
       SAFE HTML
    ===================================================== */

    function safeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /* =====================================================
       MONEY FORMAT
    ===================================================== */

    function formatMoney(amount) {
        return "₹" + Number(amount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /* =====================================================
       PREVIEW TOTAL
    ===================================================== */

    function getTotal() {
        return previewItems.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );
    }

    /* =====================================================
       MAIN FORM FIELDS (Quantity + Amount)
       One expense  -> its quantity
       Many         -> total quantity
       (every row is still saved with its own quantity)
    ===================================================== */

    function getTotalQuantity() {
        return previewItems.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
        );
    }

    function syncMainFields() {

        // FIX: nothing left in the preview -> clear the main fields
        if (!previewItems.length) {
            if ($("amount")) $("amount").value = "";
            if ($("quantity")) $("quantity").value = "1";
            return;
        }

        if ($("amount")) {
            $("amount").value = getTotal().toFixed(2);
        }

        if ($("quantity")) {
            const qty = previewItems.length === 1
                ? Number(previewItems[0].quantity || 1)
                : getTotalQuantity();

            $("quantity").value = String(
                Number.isFinite(qty) && qty > 0 ? Number(qty.toFixed(3)) : 1
            );
        }
    }

    /* =====================================================
       DROPDOWN OPTIONS
    ===================================================== */

    function optionsHTML(selectId, selected) {

        const select = $(selectId);

        if (!select) return "";

        return [...select.options]
            .filter(option => option.value)
            .map(option => {

                const isSelected =
                    option.value.toLowerCase() ===
                    String(selected || "").toLowerCase();

                return `
                    <option value="${safeHTML(option.value)}"
                        ${isSelected ? "selected" : ""}>
                        ${safeHTML(option.value)}
                    </option>
                `;
            })
            .join("");
    }

    /* =====================================================
       RENDER PREVIEW TABLE
    ===================================================== */

    function renderPreview() {

        const container = $("voiceExpensePreview");

        if (!container) return;

        if (!previewItems.length) {
            container.style.display = "none";
            container.innerHTML = "";
            return;
        }

        container.style.display = "block";

        container.innerHTML = `

            <div class="voice-preview-header">
                <div>
                    <h5><i class="fa-solid fa-list-check"></i> Review Your Expenses</h5>
                    <p>${previewItems.length} separate expenses detected. Check each row before saving.</p>
                </div>

                <button type="button" class="btn btn-sm btn-soft" id="voiceDiscardBtn">
                    <i class="fa-solid fa-trash"></i> Discard
                </button>
            </div>

            <div class="voice-preview-list">

                <div class="voice-expense-table-header">
                    <span>No.</span>
                    <span>Description</span>
                    <span>Quantity</span>
                    <span>Amount (₹)</span>
                    <span>Expense Type</span>
                    <span>Category</span>
                    <span>Action</span>
                </div>

                ${previewItems.map((item, index) => `

                    <div class="voice-expense-row">

                        <span class="voice-row-number">${index + 1}</span>

                        <div class="voice-cell">
                            <input
                                type="text"
                                class="form-control voice-item-description"
                                data-index="${index}"
                                aria-label="Description for expense ${index + 1}"
                                value="${safeHTML(item.comment)}"
                            >
                        </div>

                        <div class="voice-cell">
                            <input
                                type="number"
                                class="form-control voice-item-quantity"
                                data-index="${index}"
                                aria-label="Quantity for expense ${index + 1}"
                                min="0.01"
                                step="0.01"
                                value="${Number(item.quantity || 1)}"
                            >
                        </div>

                        <div class="voice-cell">
                            <input
                                type="number"
                                class="form-control voice-item-amount"
                                data-index="${index}"
                                aria-label="Amount for expense ${index + 1}"
                                min="0.01"
                                step="0.01"
                                value="${Number(item.amount).toFixed(2)}"
                            >
                        </div>

                        <div class="voice-cell">
                            <select
                                class="form-select voice-item-type"
                                data-index="${index}"
                                aria-label="Expense type for expense ${index + 1}"
                            >
                                <option value="">Select type</option>
                                ${optionsHTML("expenseType", item.expense_type)}
                            </select>
                        </div>

                        <div class="voice-cell">
                            <select
                                class="form-select voice-item-category"
                                data-index="${index}"
                                aria-label="Category for expense ${index + 1}"
                            >
                                <option value="">Select category</option>
                                ${optionsHTML("category", item.category)}
                            </select>
                        </div>

                        <button
                            type="button"
                            class="btn btn-outline-danger voice-remove"
                            data-index="${index}"
                            aria-label="Remove expense ${index + 1}"
                            title="Remove expense"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>

                `).join("")}

            </div>

            <div class="voice-total">
                <span>
                    Total Amount
                    <small id="voiceExpenseCount">${previewItems.length} expenses</small>
                </span>
                <strong id="voiceTotalAmount">${formatMoney(getTotal())}</strong>
            </div>

            <button type="button" class="btn btn-primary btn-lg w-100 mt-3" id="voiceSaveAllBtn">
                <i class="fa-solid fa-floppy-disk me-2"></i>
                Save All ${previewItems.length} Expenses
            </button>
        `;

        /* DESCRIPTION */
        container.querySelectorAll(".voice-item-description")
            .forEach(input => {
                input.addEventListener("input", () => {
                    previewItems[Number(input.dataset.index)].comment = input.value;
                });
            });

        /* QUANTITY */
        container.querySelectorAll(".voice-item-quantity")
            .forEach(input => {
                input.addEventListener("input", () => {
                    previewItems[Number(input.dataset.index)].quantity = input.value;
                    updateTotal();
                });
            });

        /* AMOUNT */
        container.querySelectorAll(".voice-item-amount")
            .forEach(input => {
                input.addEventListener("input", () => {
                    previewItems[Number(input.dataset.index)].amount = input.value;
                    updateTotal();
                });
            });

        /* EXPENSE TYPE */
        container.querySelectorAll(".voice-item-type")
            .forEach(select => {
                select.addEventListener("change", () => {
                    previewItems[Number(select.dataset.index)].expense_type = select.value;
                });
            });

        /* CATEGORY */
        container.querySelectorAll(".voice-item-category")
            .forEach(select => {
                select.addEventListener("change", () => {
                    previewItems[Number(select.dataset.index)].category = select.value;
                });
            });

        /* REMOVE ROW */
        container.querySelectorAll(".voice-remove")
            .forEach(button => {
                button.addEventListener("click", () => {
                    previewItems.splice(Number(button.dataset.index), 1);
                    renderPreview();
                    renderChips();
                    updateTotal();
                });
            });

        /* DISCARD ALL */
        $("voiceDiscardBtn").addEventListener("click", () => {
            previewItems = [];
            renderPreview();
            renderChips();

            if ($("amount")) $("amount").value = "";
            if ($("comment")) $("comment").value = "";
            if ($("quantity")) $("quantity").value = "1";

            setStatus("idle", "Expenses discarded.");
        });

        $("voiceSaveAllBtn").addEventListener("click", saveAllExpenses);
    }

    /* =====================================================
       UPDATE TOTAL
    ===================================================== */

    function updateTotal() {

        const total = getTotal();

        if ($("voiceTotalAmount")) {
            $("voiceTotalAmount").textContent = formatMoney(total);
        }

        syncMainFields();

        if ($("voiceExpenseCount")) {
            $("voiceExpenseCount").textContent =
                `${previewItems.length} expenses`;
        }

        if ($("voiceSaveAllBtn")) {
            $("voiceSaveAllBtn").innerHTML = `
                <i class="fa-solid fa-floppy-disk me-2"></i>
                Save All ${previewItems.length} Expenses
            `;
        }

        renderChips();
    }

    /* =====================================================
       SAVE ALL EXPENSES
    ===================================================== */

    async function saveAllExpenses() {

        if (isSaving) return;

        if (!previewItems.length) {
            return showError("No expenses to save.");
        }

        for (let i = 0; i < previewItems.length; i++) {

            const item = previewItems[i];


            if (
                !Number.isFinite(Number(item.quantity)) ||
                Number(item.quantity) <= 0
            ) {
                return showError(`Enter a valid quantity for expense ${i + 1}.`);
            }

            if (
                !Number.isFinite(Number(item.amount)) ||
                Number(item.amount) <= 0
            ) {
                return showError(`Enter a valid amount for expense ${i + 1}.`);
            }


        }

        if (typeof window.saveVoiceExpenseBatch !== "function") {
            return showError("Batch save function not found in index.js.");
        }

        isSaving = true;

        const button = $("voiceSaveAllBtn");

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        try {

            const count = previewItems.length;

            const success = await window.saveVoiceExpenseBatch(previewItems);

            if (!success) return;

            previewItems = [];

            renderPreview();

            $("voiceTranscript").value = "";
            $("voiceChips").innerHTML = "";
            $("comment").value = "";
            $("amount").value = "";
            $("quantity").value = "1";

            finalTranscript = "";
            interimTranscript = "";

            setStatus(
                "ok",
                `${count} separate expenses saved successfully.`
            );

        } catch (error) {

            console.error(error);
            showError(error.message || "Unable to save expenses.");

        } finally {

            isSaving = false;

            // FIX: when saving fails the button used to stay on "Saving..."
            if (previewItems.length && $("voiceSaveAllBtn")) {
                $("voiceSaveAllBtn").disabled = false;
                updateTotal();          // restores the "Save All N Expenses" label
            }
        }
    }

    /* =====================================================
       APPLY TRANSCRIPT
    ===================================================== */

    function applyText(text) {

        text = String(text || "").trim();

        if (!text) {
            return setStatus("warn", "Please speak or enter your expenses.");
        }

        const creator = "";   // creator comes from the login, never from speech
        const date = detectDate(text);

        if (date) {
            $("expenseDate").value = date;
        }

        const detected = extractExpenses(text, creator || "");

        if (!detected.length) {

            $("comment").value = text;

            return setStatus(
                "warn",
                "No amounts were recognised. Try saying each item followed by its amount."
            );
        }

        const fallbackType = $("expenseType").value;
        const fallbackCategory = $("category").value;

        previewItems = detected.map(item => {

            const classification = detectClassification(item.comment);

            return {
                comment: item.comment,
                quantity: item.quantity || 1,
                amount: item.amount,
                expense_type: classification.expense_type || fallbackType,
                category: classification.category || fallbackCategory
            };
        });

        $("comment").value = text;
        syncMainFields();

        renderPreview();
        renderChips();

        setStatus(
            "ok",
            `${previewItems.length} expenses detected. Total: ${formatMoney(getTotal())}. Review each row and save separately.`
        );

        $("voiceExpensePreview").scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    /* =====================================================
       RESULT CHIPS
    ===================================================== */

    function renderChips() {

        const chips = $("voiceChips");

        if (!chips) return;

        const values = [
            ["fa-list", "Expenses", previewItems.length],
            ["fa-boxes-stacked", "Total Quantity",
                previewItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)],
            ["fa-indian-rupee-sign", "Total", formatMoney(getTotal())],
            ["fa-user", "Creator", $("creator")?.value || "Not selected"],
            ["fa-calendar", "Date", $("expenseDate")?.value || "Not selected"]
        ];

        chips.innerHTML = values.map(([icon, label, value]) => `
            <span class="vchip ok">
                <i class="fa-solid ${icon}"></i>
                ${safeHTML(label)}:
                <b>${safeHTML(value)}</b>
            </span>
        `).join("");
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function setStatus(type, message) {

        const status = $("voiceStatus");

        if (status) {
            status.className = "voice-status " + type;
            status.textContent = message;
        }

        const mic = $("micBtn");

        if (mic) {
            mic.classList.toggle("listening", listening);
            mic.innerHTML = listening
                ? '<i class="fa-solid fa-stop"></i>'
                : '<i class="fa-solid fa-microphone"></i>';
        }
    }

    /* =====================================================
       MERGE SPEECH RESULTS  (fixes the repeated words on Android)

       Android Chrome does not return "new words only". With
       continuous mode it returns the SAME sentence again and again,
       growing each time:  "10" , "10 கிலோ" , "10 கிலோ கேரட்" ...
       and marks every one of them as final.
       The old code appended each one, so the text repeated.
       Here a result that only repeats / extends the previous one
       REPLACES it, and only a really new phrase is appended.
    ===================================================== */

    function mergeCumulative(parts) {

        const norm = text => text.toLowerCase().replace(/\s+/g, " ").trim();

        const out = [];

        for (const raw of parts) {

            const text = String(raw || "").replace(/\s+/g, " ").trim();

            if (!text) continue;

            if (out.length) {

                const last = norm(out[out.length - 1]);
                const next = norm(text);

                // same text again, or a shorter copy of the last phrase
                if (next === last || last.startsWith(next)) continue;

                // the last phrase grew into a longer one -> replace it
                if (next.startsWith(last)) {
                    out[out.length - 1] = text;
                    continue;
                }
            }

            out.push(text);
        }

        return out.join(" ");
    }

    /* =====================================================
       SPEECH RECOGNITION
    ===================================================== */

    function startRecognition() {

        if (!listening) return;

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            listening = false;
            return setStatus(
                "error",
                "Speech recognition is not supported. Use Chrome or Edge."
            );
        }

        try {

            const instance = new SpeechRecognition();
            recognition = instance;

            instance.lang = $("voiceLang").value || "ta-IN";
            instance.continuous = true;
            instance.interimResults = true;
            instance.maxAlternatives = 1;

            instance.onstart = () => {
                setStatus(
                    "listening",
                    "Listening... Speak all your expenses and press STOP when finished."
                );
            };

            instance.onresult = event => {

                // Read EVERY result of this session and merge them.
                // (Never append by resultIndex - that causes the repeats.)
                const parts = [];

                for (let i = 0; i < event.results.length; i++) {
                    parts.push(event.results[i][0].transcript || "");
                }

                interimTranscript = mergeCumulative(parts);

                const complete = (
                    finalTranscript + " " + interimTranscript
                ).trim();

                $("voiceTranscript").value = complete;
                $("comment").value = complete;
            };

            instance.onerror = event => {

                const messages = {
                    "not-allowed": "Microphone permission denied. Allow microphone access.",
                    "service-not-allowed": "Speech recognition service is blocked.",
                    "audio-capture": "No microphone found.",
                    "network": "Voice recognition needs an internet connection.",
                    "language-not-supported": "Selected language is not supported.",
                    "no-speech": "No speech detected. Please continue or press STOP."
                };

                if ([
                    "not-allowed",
                    "service-not-allowed",
                    "audio-capture",
                    "network",
                    "language-not-supported"
                ].includes(event.error)) {

                    listening = false;
                    manualStop = false;

                    if (restartTimer) {
                        clearTimeout(restartTimer);
                        restartTimer = null;
                    }

                    setStatus("error", messages[event.error] || "Voice recognition error.");

                } else if (event.error === "no-speech") {
                    setStatus("listening", messages[event.error]);
                }
            };

            instance.onend = () => {

                if (recognition !== instance) return;

                recognition = null;

                // keep what this session heard, then start the next one clean
                finalTranscript = (
                    finalTranscript + " " + interimTranscript
                ).trim();
                interimTranscript = "";

                if (listening && !manualStop) {

                    restartTimer = setTimeout(() => {
                        restartTimer = null;

                        if (listening) {
                            startRecognition();
                        }
                    }, 400);

                } else if (manualStop) {

                    manualStop = false;
                    completeRecording();
                }
            };

            instance.start();

        } catch (error) {

            console.error("Recognition error:", error);

            listening = false;
            manualStop = false;

            setStatus("error", "Unable to start microphone. Try again.");
        }
    }

    /* =====================================================
       START RECORDING
    ===================================================== */

    function startListening() {

        if (listening) return;

        finalTranscript = "";
        interimTranscript = "";
        previewItems = [];

        $("voiceTranscript").value = "";
        $("voiceChips").innerHTML = "";
        $("comment").value = "";
        $("amount").value = "";
        $("quantity").value = "1";

        renderPreview();

        listening = true;
        manualStop = false;

        setStatus("listening", "Starting microphone...");
        startRecognition();
    }

    /* =====================================================
       STOP RECORDING
    ===================================================== */

    function stopListening() {

        if (!listening) return;

        listening = false;
        manualStop = true;

        if (restartTimer) {
            clearTimeout(restartTimer);
            restartTimer = null;
        }

        setStatus("idle", "Recording stopped. Processing expenses...");

        if (recognition) {

            try {
                recognition.stop();
            } catch (error) {
                console.warn(error);
                recognition = null;
                manualStop = false;
                completeRecording();
            }

        } else {

            manualStop = false;
            completeRecording();
        }
    }

    /* =====================================================
       COMPLETE RECORDING
    ===================================================== */

    function completeRecording() {

        const text = (
            (finalTranscript + " " + interimTranscript).trim() ||
            $("voiceTranscript").value ||
            ""
        ).trim();

        if (!text) {
            return setStatus("warn", "No speech detected. Please try again.");
        }

        $("voiceTranscript").value = text;
        $("comment").value = text;

        applyText(text);
    }

    /* =====================================================
       CLEAR RECORDING
    ===================================================== */

    function clearRecording() {

        if (listening) {

            listening = false;
            manualStop = false;

            if (restartTimer) {
                clearTimeout(restartTimer);
                restartTimer = null;
            }

            if (recognition) {

                const current = recognition;
                recognition = null;

                try {
                    current.abort();
                } catch (error) {
                    console.warn(error);
                }
            }
        }

        finalTranscript = "";
        interimTranscript = "";
        previewItems = [];

        $("voiceTranscript").value = "";
        $("voiceChips").innerHTML = "";
        $("comment").value = "";
        $("amount").value = "";
        $("quantity").value = "1";

        renderPreview();

        setStatus("idle", "Tap the mic to start.");
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    document.addEventListener("DOMContentLoaded", () => {

        const mic = $("micBtn");

        if (!mic) return;

        // FIX: these two buttons now work even when the browser has no
        // speech recognition (you can type/paste text and press Fill).
        $("voiceFillBtn")?.addEventListener("click", () => {
            applyText($("voiceTranscript").value);
        });

        $("voiceClearBtn")?.addEventListener("click", clearRecording);

        if ($("voiceLang")) {

            $("voiceLang").value =
                localStorage.getItem("voice_lang") || "ta-IN";

            $("voiceLang").addEventListener("change", () => {
                localStorage.setItem("voice_lang", $("voiceLang").value);
            });
        }

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {

            mic.disabled = true;

            setStatus(
                "error",
                "Voice recording is unavailable in this browser (use Chrome or Edge). " +
                "You can still type your expenses in the box and press Fill Form from Text."
            );

            return;
        }

        mic.addEventListener("click", () => {
            if (listening) {
                stopListening();
            } else {
                startListening();
            }
        });

        setStatus("idle", "Tap the mic to start.");
    });

})();
