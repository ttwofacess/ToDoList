# To-Do List - Lista de Tareas Minimalista

Una aplicación web simple y elegante para gestionar tus tareas diarias. La interfaz es limpia, moderna y responsive, con soporte para tema claro y oscuro según las preferencias del sistema.

![ToDo List Screenshot](https://github.com/user-attachments/assets/966b9ee4-98ff-4680-808a-53c5bc6866a1)

## ✨ Características

- **Añadir Tareas**: Agrega nuevas tareas fácilmente a través de un campo de entrada intuitivo.
- **Marcar como Completadas**: Haz clic en una tarea para marcarla como completada. El estilo cambiará para reflejar el estado.
- **Eliminar Tareas**: Borra tareas que ya no necesites con un solo clic.
- **Ordenar Tareas**: Reorganiza tu lista para mostrar las tareas pendientes primero.
- **Persistencia de Datos**: Las tareas se guardan en el `localStorage` de tu navegador, por lo que no las perderás al recargar la página.
- **Diseño Moderno**: Interfaz de usuario actualizada con una paleta de colores agradable, tipografía moderna y micro-interacciones.
- **Tema Claro y Oscuro**: La apariencia se adapta automáticamente al tema de tu sistema operativo.
- **Seguridad**: Se utiliza `DOMPurify` para sanitizar las entradas del usuario y prevenir ataques XSS.

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Para la estructura semántica de la aplicación.
- **CSS3**: Para los estilos, el diseño responsive y la tematización (claro/oscuro) utilizando variables CSS.
- **JavaScript (ES6+)**: Para toda la lógica de la aplicación, incluyendo la manipulación del DOM y la interacción con `localStorage`.
- **Google Fonts**: Se utilizan las fuentes "Poppins" y "Roboto" para una mejor legibilidad y un diseño más pulido.
- **DOMPurify**: Para la sanitización de HTML y prevención de XSS.

## 🚀 Cómo Usar

No se requiere ninguna instalación o construcción. Simplemente abre el archivo `index.html` en tu navegador web preferido.

1.  Clona o descarga este repositorio.
2.  Navega a la carpeta del proyecto.
3.  Abre `index.html` en tu navegador.

## 🎨 Personalización

Puedes personalizar fácilmente la apariencia de la lista de tareas modificando las variables CSS que se encuentran en la parte superior del archivo `style.css`.

```css
:root {
    --bckgrndbdy: #F0F2F5;      /* Fondo principal */
    --btnordr: #6C63FF;         /* Botón de ordenar */
    --btnplus: #FF6584;         /* Botón de añadir (+) */
    --donetsk: #50C878;         /* Tareas completadas */
    --wrpprbck: #FFFFFF;       /* Fondo del contenedor principal */
    --maintxt: #333333;         /* Color del texto principal */
    --primary: #6C63FF;         /* Color de acento principal */
    --shadow: 0 4px 6px rgba(0,0,0,0.1); /* Sombra del contenedor */
}
```
