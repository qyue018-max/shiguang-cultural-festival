import {
  createLightPoint,
  loadLightPoints,
  resetLightPoints,
  saveLightPoints,
  validateLightProfile,
} from './light-point-store.js';

const $ = (id) => document.getElementById(id);
const layer = $('light-point-layer');
const count = $('light-point-count');
const modal = $('light-point-modal');
const form = $('light-point-form');
const detail = $('light-point-detail');
const errorBox = $('light-point-error');
const toast = $('light-point-toast');
const message = form.elements.message;
let points = loadLightPoints(localStorage);

function showDetail(point) {
  for (const [field, value] of Object.entries(point)) {
    const target = detail.querySelector(`[data-field="${field}"]`);
    if (target) target.textContent = value;
  }
  detail.hidden = false;
}

function render() {
  layer.replaceChildren();
  count.textContent = points.length;
  points.forEach((point, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `lp-point${point.mine ? ' mine' : ''}`;
    button.style.left = `${point.x}%`;
    button.style.top = `${point.y}%`;
    button.style.animationDelay = `${(index % 8) * -.37}s`;
    button.setAttribute('aria-label', `查看${point.name}的光点`);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      showDetail(point);
    });
    layer.appendChild(button);
  });
}

function openModal() {
  detail.hidden = true;
  modal.hidden = false;
  errorBox.hidden = true;
  form.elements.name.focus();
}

function close(target) {
  $(target).hidden = true;
}

function notify(text) {
  toast.textContent = text;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 1800);
}

$('light-point-create').addEventListener('click', openModal);
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => close(button.dataset.close)));
modal.addEventListener('click', (event) => { if (event.target === modal) close('light-point-modal'); });
message.addEventListener('input', () => { $('light-point-message-count').textContent = [...message.value].length; });

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = Object.fromEntries(new FormData(form));
  const validationError = validateLightProfile(profile);
  if (validationError) {
    errorBox.textContent = validationError;
    errorBox.hidden = false;
    return;
  }
  const point = createLightPoint(profile, points.length);
  points = [...points.map((item) => ({ ...item, mine: false })), point];
  saveLightPoints(localStorage, points);
  render();
  modal.hidden = true;
  showDetail(point);
  notify(`点亮成功 · 拾光者 No.${point.number}`);
});

$('light-point-reset').addEventListener('click', () => {
  points = resetLightPoints(localStorage);
  detail.hidden = true;
  render();
  notify('演示数据已重置');
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  modal.hidden = true;
  detail.hidden = true;
});

render();
