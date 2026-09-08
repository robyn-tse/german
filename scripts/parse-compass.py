# Parses the English Compass word list (inbox/archive/lesson-02/1Wortliste_A1_A2_B1.pdf)
# into classified rows, for a later decision to pull some of it into vocab.json.
# Deferred on 2026-09-08: Robyn wants a concentrated essentials set first, not 1,500 words.
#   .venv/bin/python scripts/parse-compass.py  -> prints counts; rows land in the scratch dir given below.
import re, json
S='/private/tmp/claude-501/-Users-robyntse-Documents-GitHub-german/ca736433-b442-4338-9cae-42e2d0bb181b/scratchpad'
PREP = set('in an auf über unter mit ohne für gegen nach vor zu bei aus von seit durch um zwischen hinter neben entlang trotz wegen während ab bis gegenüber innerhalb außerhalb oberhalb unterhalb pro per'.split())
CONJ = set('und oder aber denn weil dass wenn ob als obwohl sondern bevor nachdem damit falls sobald während'.split())
PRON = set('ich du er sie es wir ihr Sie mich dich ihn uns euch mir dir ihm ihnen Ihnen man jemand niemand etwas nichts alles jeder jede jedes mein dein sein unser euer ihr Ihr wer wen wem was welcher welche welches dieser diese dieses jener'.split())
ADV = set('hier dort da jetzt heute morgen gestern immer nie oft manchmal sehr auch nur noch schon wieder dann bald oben unten links rechts gern gerne leider vielleicht fast ziemlich wirklich sofort später früher zuerst endlich überall nirgends draußen drinnen zusammen allein vorne hinten weg fort her hin herum zurück ja nein doch nicht so wie wo wann warum wohin woher nun eben gerade genau natürlich besonders meistens selten ungefähr etwa circa bereits erst nochmal wieder außerdem trotzdem deshalb darum sonst ebenfalls ebenso genauso unbedingt eigentlich wahrscheinlich hoffentlich sicherlich überhaupt ganz halb kaum mehr weniger genug viel wenig zu einmal zweimal oftmals täglich wöchentlich monatlich jährlich abends morgens nachts mittags vormittags nachmittags heutzutage damals inzwischen mittlerweile längst neulich vorhin gleich demnächst irgendwo irgendwann irgendwie anders woanders'.split())
NOT_VERB = set('offen oben unten gegen wegen neben zwischen morgen gestern eigen dann schon kein ein drinnen draußen vorn hinten innen außen selten eben wen den denen allen mein dein kein gern nein man wann wenn denn einen jeden golden zufrieden geschlossen gebrochen verloren verheiratet betrunken erfahren gelegen willkommen erwachsen offen bekannt eigen selten zusammen entfernt gesund krank ohnehin nebenan daneben dagegen dazwischen sogen'.split())
NUMBERS = set('null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn zwanzig dreißig vierzig fünfzig sechzig siebzig achtzig neunzig hundert tausend million milliarde'.split())

def norm_en(en):
    en = re.sub(r'\s*\([^)]*\)', '', en)            # make (made, made)
    en = re.sub(r',\s*-\w+', '', en)                  # comedy, -ies ; policeman, -men
    if ': ' in en: en = en.split(': ', 1)[1]          # afraid: be afraid of
    en = re.sub(r',\s*(people|men|women|children|feet|teeth|mice|geese)$', '', en)
    return en.strip()

def norm_de(de):
    de = re.sub(r'^etwa:\s*', '', de)
    de = de.replace('(sich)', 'sich').replace('(in)', '').replace('(innen)', '').replace('(r, -s)', '').replace('(r)', '')
    de = re.sub(r'\s*\([^)]*\)', '', de)              # other parentheticals
    return re.sub(r'\s+', ' ', de).strip(' ,;')

def classify(en, de):
    """returns (pos, headword, alternatives, notes)"""
    alts = [a.strip() for a in re.split(r'[,;]\s*', de) if a.strip()]
    head = alts[0]; rest = alts[1:]
    hl = head.lower()
    if head.startswith('sich '): return 'verb', head, rest, None
    if head in PRON: return 'pronoun', head, rest, None
    if hl in NUMBERS or re.match(r'^[a-zäöü]+(te|ste)$', hl) and en.endswith(('th','first','second','third')): return 'number', hl, rest, None
    if ' ' in head or '…' in head or '...' in head:
        return 'phrase', head, rest, None
    if head[0].isupper() and not head.isupper(): return 'noun', head, rest, None
    if head.isupper(): return 'noun', head, rest, None   # abbreviations
    if hl in PREP: return 'preposition', hl, rest, None
    if hl in CONJ: return 'conjunction', hl, rest, None
    if hl in ADV: return 'adverb', hl, rest, None
    if hl.endswith('n') and hl not in NOT_VERB and len(hl) > 3: return 'verb', hl, rest, None
    return 'adjective', hl, rest, None

if __name__ == '__main__':
    entries = [e for e in json.load(open(f'{S}/compass_all.json')) if e.get('level')=='A1' and not e.get('bad')]
    rows = []
    for e in entries:
        en = norm_en(e['en']); de = norm_de(e['de'])
        if not de: continue
        pos, head, rest, _ = classify(en, de)
        rows.append({'en': en, 'de': de, 'pos': pos, 'head': head, 'alts': rest, 'page': e['page']})
    json.dump(rows, open(f'{S}/compass_a1.json','w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(Counter(r['pos'] for r in rows))
    nouns = sorted({r['head'] for r in rows if r['pos']=='noun'})
    verbs = sorted({r['head'] for r in rows if r['pos']=='verb'})
    json.dump({'nouns': nouns, 'verbs': verbs}, open(f'{S}/compass_lists.json','w'), ensure_ascii=False)
    print('unique nouns', len(nouns), '| unique verbs', len(verbs))
    print('VERBS:', ' '.join(verbs))
    print('ADJ sample:', ' '.join(sorted({r['head'] for r in rows if r['pos']=='adjective'})[:150]))
    print('PHRASE sample:', ' | '.join(sorted({r['head'] for r in rows if r['pos']=='phrase'})[:40]))
