from pathlib import Path

news = Path('news-search.js')
addon = Path('cyberpulse-schedule-addon.js')
marker = '/* Cyber Pulse weekly publishing plan addon */'
text = news.read_text(encoding='utf-8')
extra = addon.read_text(encoding='utf-8').rstrip() + '\n'

# The schedule addon is deliberately kept as the final block in news-search.js.
# Replace the existing block when the plan changes instead of treating the marker
# as proof that the latest version is already installed.
pos = text.find(marker)
if pos >= 0:
    updated = text[:pos].rstrip() + '\n\n' + extra
    if updated == text:
        print('Cyber Pulse schedule addon already up to date')
    else:
        news.write_text(updated, encoding='utf-8')
        print('Cyber Pulse schedule addon upgraded to latest growth plan')
else:
    news.write_text(text.rstrip() + '\n\n' + extra, encoding='utf-8')
    print('Cyber Pulse schedule addon installed')
