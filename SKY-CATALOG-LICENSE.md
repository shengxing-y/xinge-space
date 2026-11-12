# HYG bright-star subset

`sky-catalog.js` contains a filtered and reformatted subset of **HYG v4.1**, compiled by **David Nash / Astronexus and HYG contributors**, incorporating the catalogs credited in the upstream documentation.

- Source: https://github.com/astronexus/HYG-Database/tree/main/hyg
- Original file: `hyg/CURRENT/hygdata_v41.csv`
- Upstream documentation and source credits: https://github.com/astronexus/HYG-Database/blob/main/hyg/README.md
- Retrieved: 2026-11-10
- License: **Creative Commons Attribution-ShareAlike 4.0 International** — https://creativecommons.org/licenses/by-sa/4.0/
- Full legal text: https://creativecommons.org/licenses/by-sa/4.0/legalcode

Changes: removed Sol and entries with apparent visual magnitude greater than 6; retained HYG ID, J2000.0 right ascension (hours), declination (degrees), visual magnitude, and B−V color index; sorted by magnitude and serialized as JavaScript data. The subset contains 5,070 entries. Missing color index is represented by `null`. Right ascension and declination units were checked against upstream `rarad`/`decrad` fields. Proper motion fields are not included or applied.

This derived catalog subset is shared under **CC BY-SA 4.0**. Retain attribution, the source and license links, and the notice of modifications when redistributing or adapting the data. No endorsement by the original authors is implied. No warranties are provided. See the linked license for the complete terms, including attribution and ShareAlike conditions.

This notice applies to the catalog data and derived subset, not automatically to the website's application code, journal entries, images, or audio.

## Identification metadata

`sky-names.js` is an additional CC BY-SA 4.0 HYG v4.1 derivative: 145 entries with a non-empty upstream `proper` name and visual magnitude ≤3 (excluding Sol), keyed by the original HYG ID. Retained proper names and constellation abbreviations were cross-matched by ID, not by brightness ordering or approximate sky position. Standard constellation abbreviations are presented with Chinese translations.

Forty-six common Chinese bright-star names were checked against the Hong Kong Space Museum's [English–Chinese glossary of bright stars](https://hk.space.museum/sc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-bright-stars.html). Entries without a verified Chinese name retain their upstream English name. Naming facts are used for identification; this does not imply endorsement by the museum or catalog authors. The website performs no runtime request to these sources.

## Display and calculation limits

The observer reference is 38.4177°N, 112.7335°E; the direction reference is 41.8057°N, 123.4315°E. Coordinates describe reference points, not a user's location or a surveyed observation site.

The application selects that Chinese calendar day's evening solar-center altitude −6° or morning altitude −12°, applies approximate precession from J2000, and projects geometrical horizontal star positions. Local terrain, weather, atmospheric extinction/refraction, nutation, aberration, and stellar proper motion are not modeled. Display magnitude cutoffs are aesthetic visibility approximations, not observing guarantees. The fixed Venus theme control and transition rotation are deliberately artistic exceptions, not ephemeris predictions.
