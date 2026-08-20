# Mobile Video Editor MVP

محرر فيديو Mobile-First يعمل من المتصفح على الهاتف ويمكن تثبيته كـ PWA. يرفع الفيديو والصوت إلى Cloudinary، ينشئ تعليقاً صوتياً عبر ElevenLabs، ويرسل Timeline إلى Shotstack للرندر النهائي.

## الوظائف الحالية
- رفع عدة فيديوهات من الهاتف.
- تغيير ترتيب المقاطع بالسحب.
- التحكم بصوت كل مقطع.
- فلاتر: boost / contrast / darken / greyscale / lighten / muted / blur.
- حركات: zoom / slide.
- انتقالات بين المقاطع.
- رفع صوت من الهاتف.
- إنشاء TTS عبر ElevenLabs.
- التحكم بمستوى الصوت الإضافي.
- إضافة نصوص مع وقت بداية ومدة وموقع.
- إخراج 9:16 / 4:5 / 1:1 / 16:9.
- رندر عبر Shotstack ومتابعة حالة الرندر.

## متغيرات البيئة
انسخ `.env.example` إلى `.env` محلياً أو أضف القيم في Railway Variables:

- `SHOTSTACK_API_KEY`
- `SHOTSTACK_ENV=stage` للاختبار أو `v1` للإنتاج
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID=eleven_multilingual_v2`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER=mobile-video-editor`

## تشغيل محلي
```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
ثم افتح `http://localhost:8000`.

## Railway
1. اربط GitHub repository مع Railway.
2. حدّد Root Directory إلى `video-editor-app` إذا كان المشروع داخل Monorepo.
3. Railway سيستخدم `Dockerfile` و `railway.json`.
4. أضف Environment Variables المذكورة أعلاه.
5. Generate Domain.

## ملاحظات أمنية
- مفاتيح Shotstack وElevenLabs وCloudinary Secret تبقى في Backend فقط.
- رفع الفيديو يتم مباشرة من الهاتف إلى Cloudinary باستخدام توقيع قصير العمر يصدر من Backend.
- لا تضع أي Secret داخل JavaScript أو GitHub.
