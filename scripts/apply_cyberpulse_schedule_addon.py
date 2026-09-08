from pathlib import Path
news=Path('news-search.js')
addon=Path('cyberpulse-schedule-addon.js')
marker='/* Cyber Pulse weekly publishing plan addon */'
text=news.read_text(encoding='utf-8')
extra=addon.read_text(encoding='utf-8')
if marker in text:
    print('Cyber Pulse schedule addon already installed')
else:
    news.write_text(text.rstrip()+'\n\n'+extra.rstrip()+'\n',encoding='utf-8')
    print('Cyber Pulse schedule addon appended safely to news-search.js')
