const FORBIDDEN_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "canvas",
  "link",
  "base",
  "animate",
  "animatetransform",
  "animatemotion",
  "set",
  "handler",
  "listener",
]);

const UNSAFE_VALUE = /javascript:|data:text\/html|expression\s*\(|behavior\s*:|-moz-binding/i;
const UNSAFE_STYLE = /@import|expression\s*\(|javascript:|url\s*\(\s*['"]?(?!#)/i;

/**
 * Removes active content from an SVG tree.
 *
 * Assets are expected to be inert drawings: no scripts, no event handlers and
 * no external references. Inline `<style>` blocks survive, because the theme
 * pass ships semantic colour roles inside one.
 */
export function sanitizeSvg(root: Element): void {
  const elements: Element[] = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const element of elements) {
    if (FORBIDDEN_ELEMENTS.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith("on") || name === "src") {
        element.removeAttribute(attribute.name);
      } else if (
        (name === "href" || name === "xlink:href") &&
        value &&
        !value.trim().startsWith("#")
      ) {
        element.removeAttribute(attribute.name);
      } else if (value && UNSAFE_VALUE.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const style of Array.from(root.querySelectorAll("style"))) {
    if (UNSAFE_STYLE.test(style.textContent ?? "")) {
      style.remove();
    }
  }
}
