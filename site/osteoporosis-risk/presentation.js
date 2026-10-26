/* Presentation only. Clinical assessment and FRAX logic live in app.js/logic.js. */
(() => {
  const form = document.getElementById('osteo-form');
  const update = () => {
    const male = document.getElementById('sex').value === 'male';
    document.getElementById('menopause-status-field').hidden = male;
    document.getElementById('menopause-preferences').hidden = male || document.getElementById('postmenopausal').value === 'no';
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  for (const id of ['load-sample', 'clear-form']) document.getElementById(id).addEventListener('click', update);
  update();
})();
