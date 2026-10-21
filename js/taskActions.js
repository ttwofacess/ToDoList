// ============================================================
// taskActions.js — Responsabilidad: Acciones de estado de tareas
// ============================================================

import { formatDisplayDate } from './dateUtils.js';
import { persistFromDOM } from './storage.js';

/**
 * Duración de la animación de entrada de una tarea, en ms.
 * Debe coincidir con el literal de `task-in` en styles/animations.css.
 */
export const TASK_IN_MS = 200;

/**
 * Duración de la animación de salida de una tarea, en ms.
 * Debe coincidir con el literal de `task-out` en styles/animations.css.
 */
export const TASK_OUT_MS = 200;

/**
 * Intentos de espera antes de renunciar a la animación de entrada.
 * Cada intento espera TASK_IN_MS + 50 ms, así que el máximo es ~1,5 s.
 */
const ENTER_RETRIES = 5;

/**
 * Intentos de espera antes de renunciar a la animación de salida.
 */
const EXIT_RETRIES = 5;

/**
 * Limpiezas pendientes de la animación de entrada, indexadas por wrapper.
 * Sirve para cancelar el timeout y el listener cuando la misma tarea vuelve
 * a animarse (por ejemplo al deshacer un borrado).
 * @type {WeakMap<HTMLElement, {timer: number, handler: Function}>}
 */
const pendingEnterCleanups = new WeakMap();

/**
 * Cancela la limpieza pendiente de la animación de entrada de un wrapper.
 * @param {HTMLElement} wrapper
 */
export const cancelEnterAnimation = (wrapper) => {
    const pending = pendingEnterCleanups.get(wrapper);
    if (!pending) return;
    clearTimeout(pending.timer);
    wrapper.removeEventListener('animationend', pending.handler);
    pendingEnterCleanups.delete(wrapper);
};

/**
 * Reproduce la animación de entrada de una tarea (fade + desplazamiento).
 *
 * La clase `just-added` se quita cuando termina la animación. Si el evento
 * `animationend` nunca llega —movimiento reducido, jsdom, pestaña en
 * segundo plano— la deja un timeout de reserva, para que la tarea no quede
 * con la clase pegada.
 *
 * @param {HTMLElement} wrapper
 */
export const animateTaskIn = (wrapper) => {
    cancelEnterAnimation(wrapper);

    if (wrapper.classList.contains('just-added')) {
        // La clase ya estaba puesta: sin sacarla y forzar un reflow, el
        // navegador no reinicia la animación cuando el nodo vuelve al
        // documento (por ejemplo al deshacer un borrado).
        wrapper.classList.remove('just-added');
        void wrapper.offsetWidth;
    }
    wrapper.classList.add('just-added');

    const finish = () => {
        cancelEnterAnimation(wrapper);
        wrapper.classList.remove('just-added');
    };

    const handler = (event) => {
        if (event.target !== wrapper) return;
        if (event.animationName !== 'task-in') return;
        finish();
    };

    // El navegador deja la animación "pendiente" hasta el primer frame, y ese
    // frame puede tardar bastante (por ejemplo, con el modal cerrándose
    // encima). Si el timeout de reserva se cumpliera en ese momento, la
    // clase se iría antes de que la animación arranque y la tarea aparecería
    // de golpe. Mientras la animación siga viva se espera a que termine; si
    // no hay ninguna (movimiento reducido, CSS sin cargar), se limpia.
    let retries = 0;
    const cleanup = { timer: 0, handler };

    const check = () => {
        const pending = (wrapper.getAnimations?.() ?? []).some(
            (anim) => anim.animationName === 'task-in' && anim.playState !== 'finished',
        );
        if (pending && retries < ENTER_RETRIES) {
            retries += 1;
            cleanup.timer = setTimeout(check, TASK_IN_MS + 50);
            return;
        }
        finish();
    };

    cleanup.timer = setTimeout(check, TASK_IN_MS + 50);
    pendingEnterCleanups.set(wrapper, cleanup);
    wrapper.addEventListener('animationend', handler);
};

/**
 * Cambia el estado (completado/pendiente) de una tarea.
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 */
export const changeTaskState = (wrapper, tasksContainer) => {
    const taskEl = wrapper.querySelector('.task');
    const isDone = taskEl.classList.toggle('done');

    if (isDone) {
        wrapper.setAttribute('data-last-completed', Date.now());
    } else {
        // When reactivating a recurring task, update the date to today
        const recurrence = wrapper.getAttribute('data-recurrence') || 'none';
        if (recurrence !== 'none') {
            const dateEl = wrapper.querySelector('.task-date');
            const todayStr = formatDisplayDate(new Date());
            if (dateEl) {
                dateEl.textContent = todayStr;
            }
        }
        wrapper.removeAttribute('data-last-completed');
    }

    persistFromDOM(tasksContainer);
};

/**
 * @typedef {Object} DeleteSnapshot
 * @property {HTMLElement} wrapper       Nodo eliminado (se reinserta tal cual).
 * @property {number} index              Posición que tenía entre los hijos del contenedor (-1 si no estaba).
 * @property {HTMLElement|null} nextSibling Vecino siguiente en el momento del borrado (null si era la última).
 */

/**
 * Elimina una tarea y devuelve un snapshot para poder deshacerla.
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 * @returns {DeleteSnapshot}
 */
export const deleteTask = (wrapper, tasksContainer) => {
    const index = [...tasksContainer.children].indexOf(wrapper); // -1 si no estaba
    const nextSibling = wrapper.nextElementSibling;             // null si era la última
    wrapper.remove();
    persistFromDOM(tasksContainer);
    return { wrapper, index, nextSibling };
};

/**
 * Elimina una tarea animando su salida: la tarjeta se desvanece y colapsa su
 * altura, así los vecinos de arriba suben sin saltar de golpe. El borrado real
 * ocurre cuando la animación termina.
 *
 * El snapshot se calcula AL FINAL de la animación, no al principio: durante
 * los ~200 ms de la salida no se puede insertar ninguna tarea (el modal de
 * creación está cerrado y el de acciones también), así que el índice y el
 * vecino siguiente siguen siendo válidos.
 *
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 * @returns {Promise<DeleteSnapshot|null>} null si ya había una salida en curso.
 */
export const animateOutAndDelete = (wrapper, tasksContainer) => {
    // Ya hay una salida en curso: no se borra dos veces ni se muestra otro
    // aviso. La promesa pendiente se encarga del borrado.
    if (wrapper.classList.contains('leaving')) return Promise.resolve(null);

    // No está en el documento: no hay nada que animar.
    if (!wrapper.isConnected) {
        return Promise.resolve(deleteTask(wrapper, tasksContainer));
    }

    // La altura no se puede expresar en CSS (los wrappers crecen con las
    // subtareas), así que se mide y se pasa por variable: los keyframes no
    // pueden animar de `auto` a 0.
    const height = wrapper.getBoundingClientRect().height;
    wrapper.style.setProperty('--task-out-height', `${height}px`);
    wrapper.classList.add('leaving');

    return new Promise((resolve) => {
        let timer = 0;
        let retries = 0;
        let onEnd = null;

        const finish = () => {
            clearTimeout(timer);
            if (onEnd) wrapper.removeEventListener('animationend', onEnd);
            // La clase y la variable se borran antes de sacar el nodo: si la
            // tarea se deshace más tarde, el wrapper vuelve al DOM sin la
            // animación de salida (que además dejaría la tarjeta sin clicks).
            wrapper.classList.remove('leaving');
            wrapper.style.removeProperty('--task-out-height');
            resolve(deleteTask(wrapper, tasksContainer));
        };

        onEnd = (event) => {
            if (event.target !== wrapper) return;
            if (event.animationName !== 'task-out') return;
            finish();
        };

        // Red de seguridad: si la animación no corre (movimiento reducido, CSS
        // sin cargar, pestaña en segundo plano) el borrado ocurre igual. Si la
        // animación está viva pero pendiente de arrancar, se la espera.
        const check = () => {
            const pending = (wrapper.getAnimations?.() ?? []).some(
                (anim) => anim.animationName === 'task-out' && anim.playState !== 'finished',
            );
            if (pending && retries < EXIT_RETRIES) {
                retries += 1;
                timer = setTimeout(check, TASK_OUT_MS + 50);
                return;
            }
            finish();
        };

        wrapper.addEventListener('animationend', onEnd);
        timer = setTimeout(check, TASK_OUT_MS + 50);
    });
};

/**
 * Reinserta una tarea borrada en su posición original y persiste.
 *
 * La tarea vuelve a entrar con la misma animación de creación: si todavía
 * tenía la clase `just-added` de antes de borrarse, `animateTaskIn` la saca,
 * fuerza un reflow y la vuelve a poner, que es lo que hace que la animación
 * corra de nuevo sobre un nodo que sale y vuelve al documento.
 *
 * @param {DeleteSnapshot} snapshot
 * @param {HTMLElement} tasksContainer
 * @returns {'restored'|'already-restored'}
 */
export const restoreTask = ({ wrapper, index, nextSibling }, tasksContainer) => {
    if (wrapper.isConnected) return 'already-restored';

    if (nextSibling && nextSibling.parentNode === tasksContainer) {
        tasksContainer.insertBefore(wrapper, nextSibling);       // caso normal
    } else if (nextSibling === null) {
        tasksContainer.appendChild(wrapper);                     // era la última
    } else {
        // el vecino ya no existe: usar el índice original acotado
        const ref = tasksContainer.children[index] ?? null;
        tasksContainer.insertBefore(wrapper, ref);
    }

    // Después de insertar: el reflow que hace animateTaskIn sólo sirve si el
    // nodo ya está en el documento.
    animateTaskIn(wrapper);

    persistFromDOM(tasksContainer);
    return 'restored';
};
