/* Fix LinkedIn AI Studio design selection without duplicating base64 images in localStorage. */
(() => {
  const STORAGE = 'cyberpulse_linkedin_ai_studio_v2';

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE)) || {posts: []}; }
    catch { return {posts: []}; }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function getPost(card) {
    const id = card?.dataset?.id;
    const state = loadState();
    return { state, post: state.posts.find(p => p.id === id) };
  }

  function paintSelection(card, index) {
    card.querySelectorAll('.lai-option').forEach((option, i) => {
      const button = option.querySelector('[data-select]');
      const selected = i === index;
      option.classList.toggle('selected', selected);
      if (button) {
        button.classList.toggle('secondary', !selected);
        button.textContent = selected ? '✓ التصميم المختار' : 'اعتماد هذا التصميم';
      }
    });
    const status = card.querySelector('.lai-post-status');
    if (status) status.textContent = `تم اختيار التصميم ${index + 1}.`;
  }

  document.addEventListener('click', async (event) => {
    const selectButton = event.target.closest('[data-select]');
    if (selectButton) {
      const card = selectButton.closest('.lai-post');
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const index = Number(selectButton.dataset.select);
      const { state, post } = getPost(card);
      if (!post || !post.visual_options?.[index]) return;

      // Save only the index. Do not duplicate the large base64 image into assets.
      post.selected_visual = index;
      post.assets = [];
      try {
        saveState(state);
        paintSelection(card, index);
      } catch (error) {
        const status = card.querySelector('.lai-post-status');
        if (status) status.textContent = `تعذر حفظ الاختيار: ${error.message}`;
      }
      return;
    }

    const publishButton = event.target.closest('[data-act="publish"]');
    if (publishButton) {
      const card = publishButton.closest('.lai-post');
      if (!card) return;

      const { post } = getPost(card);
      if (!post || post.type === 'Carousel') return; // keep existing carousel path

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const status = card.querySelector('.lai-post-status');
      if (post.status !== 'APPROVED') {
        if (status) status.textContent = 'اعتمد المنشور أولًا.';
        return;
      }

      const selected = Number.isInteger(post.selected_visual) ? post.selected_visual : Number(post.selected_visual);
      const image = post.visual_options?.[selected];
      if (!image?.data_url) {
        if (status) status.textContent = 'اختر أحد التصميمين أولًا.';
        return;
      }

      if (status) status.textContent = 'جاري فتح معاينة LinkedIn بالصورة المختارة...';
      await window.cyberPulseLinkedIn?.publish(post.text, [image]);
      return;
    }
  }, true);
})();
