export default function appCard(manifest) {
  return {
    state: manifest,
    tag: ".box-h.mb-xl",
    content: [
      {
        if: "{{icons.length}}",
        tag: "img._mt.pa._checkboard.inset",
        src: "{{icons/2/src ?? icons/1/src ?? icons/0/src}}",
      },
      {
        tag: ".pa.pt-0",
        content: [
          { tag: "h1.mt-0", content: "{{name}}" },
          { tag: "p.mt-0", content: "{{description}}" },
          {
            tag: "ul.unstyled.d-flex.gap-sm",
            content: {
              scope: "categories",
              each: {
                tag: "li.pill",
                content: "{{titleCase(.)}}",
              },
            },
          },
        ],
      },
    ],
  }
}
