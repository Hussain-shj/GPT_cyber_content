from pathlib import Path

news = Path('news-search.js')
addon = Path('cyberpulse-copy-addon.js')
marker = '/* Cyber Pulse copy addon — preserve post formatting, symbols and line breaks */'
text = news.read_text(encoding='utf-8')
extra = addon.read_text(encoding='utf-8')
if marker in text:
    print('Cyber Pulse copy addon already installed')
else:
    news.write_text(text.rstrip() + '\n\n' + extra.rstrip() + '\n', encoding='utf-8')
    print('Cyber Pulse copy addon appended safely to news-search.js')
