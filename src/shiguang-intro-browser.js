import { createIntroFlow } from './shiguang-intro.js';

export function mountIntro({ root, windowObject, schedule = setTimeout }) {
  const intro = root.getElementById('shiguang-intro');
  const enter = root.getElementById('shiguang-enter');
  const skip = root.getElementById('shiguang-skip');
  const status = root.getElementById('shiguang-status');
  const reduceMotion = windowObject.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const flow = createIntroFlow({ durationMs: reduceMotion ? 0 : 3000 });

  const showGalaxy = () => {
    flow.finish();
    intro.classList.add('done');
    root.body.classList.remove('shiguang-intro-active');
    status.textContent = '';
  };

  const ready = () => {
    enter.disabled = false;
    enter.textContent = '拾起这束光';
    status.textContent = '触碰星光，进入银河';
  };

  enter.addEventListener('click', () => {
    const next = flow.start();
    if (next.state !== 'transitioning' || intro.classList.contains?.('transitioning')) return;
    enter.disabled = true;
    intro.classList.add('transitioning');
    status.textContent = '正在穿越星河';
    schedule(showGalaxy, next.durationMs);
  });
  skip.addEventListener('click', () => {
    flow.skip();
    showGalaxy();
  });

  if (root.readyState !== 'loading') ready();
  else windowObject.addEventListener('load', ready, { once: true });

  return flow;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  mountIntro({ root: document, windowObject: window });
}
