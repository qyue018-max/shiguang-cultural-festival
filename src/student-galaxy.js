export function mergeStudentPlanets(planets, mine) {
  return mine ? [mine, ...planets.filter((planet) => planet.id !== mine.id)] : [...planets];
}

export function planetScreenPosition(planet) {
  return { x: 50 + Math.cos(planet.angle || 0) * (planet.radius || 0) * .75, y: 50 + Math.sin(planet.angle || 0) * (planet.radius || 0) * .55 };
}

export function renderStudentGalaxy(container, planets, onSelect) {
  container.replaceChildren();
  planets.forEach((planet, index) => {
    const button = document.createElement('button');
    const position = planetScreenPosition(planet);
    button.type = 'button'; button.className = `student-star${index === 0 ? ' is-mine' : ''}`;
    button.style.left = `${position.x}%`; button.style.top = `${position.y}%`;
    button.style.setProperty('--star-color', planet.palette?.primary || planet.color || '#77c8ff');
    button.setAttribute('aria-label', `${planet.nickname || '我的'}：${planet.planetName}`);
    button.addEventListener('click', (event) => { event.stopPropagation(); onSelect(planet); });
    container.appendChild(button);
  });
}
