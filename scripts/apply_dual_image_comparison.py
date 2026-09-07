from pathlib import Path

main=Path('main.py')
news=Path('news-search.js')
addon=Path('cyberpulse-dual-image-addon.js')
text=main.read_text(encoding='utf-8')
marker='@app.post("/api/generate-image-dual")'
if marker not in text:
    block=r'''

@app.post("/api/generate-image-dual")
def generate_image_dual(req: ImageRequest):
    """Generate the same Cyber Pulse artwork with Nano Banana and OpenAI for side-by-side comparison."""
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(400, "لم يتم إعداد Nano Banana أو OpenAI لتوليد الصور")
    prompt = visual_prompt(req)
    images = []
    errors = []
    if os.getenv("GEMINI_API_KEY"):
        try:
            b64, model = generate_nano_banana_image(prompt)
            images.append({"provider":"google_nano_banana_2","model":model,"b64_json":b64,"mime_type":"image/jpeg"})
        except Exception as exc:
            errors.append("Nano Banana: " + str(exc)[:350])
    else:
        errors.append("Nano Banana غير مهيأ")
    if os.getenv("OPENAI_API_KEY"):
        try:
            b64, model = generate_openai_image(prompt)
            images.append({"provider":"openai","model":model,"b64_json":b64,"mime_type":"image/jpeg"})
        except Exception as exc:
            errors.append("OpenAI: " + str(exc)[:350])
    else:
        errors.append("OpenAI غير مهيأ")
    if not images:
        raise HTTPException(502, "فشل توليد الصورتين: " + " | ".join(errors))
    return {"images":images,"errors":errors,"same_prompt":True,"slide_number":req.slide_number,"artwork_version":"dual-provider-comparison-v1"}
'''
    text=text.rstrip()+block+'\n'
    main.write_text(text,encoding='utf-8')
    print('dual endpoint appended to main.py')
else:
    print('dual endpoint already installed')

js=news.read_text(encoding='utf-8')
extra=addon.read_text(encoding='utf-8')
jsmarker='/* Cyber Pulse dual image comparison — Nano Banana + OpenAI */'
if jsmarker not in js:
    news.write_text(js.rstrip()+'\n\n'+extra.rstrip()+'\n',encoding='utf-8')
    print('dual comparison UI appended to news-search.js')
else:
    print('dual comparison UI already installed')
