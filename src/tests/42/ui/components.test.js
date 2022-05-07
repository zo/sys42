import test from "../../../42/test.js"
import ui from "../../../42/ui.js"
import Component from "../../../42/ui/class/Component.js"
import repaint from "../../../42/fabric/type/promise/repaint.js"

const elements = []
function div(connect = true) {
  const el = document.createElement("div")
  elements.push(el)
  if (connect) document.body.append(el)
  return el
}

test.afterEach(() => {
  for (const el of elements) el.remove()
  elements.length = 0
})

Component.define({
  tag: "ui-t-props",
  props: {
    bar: 2,
  },
  content: "foo: {{foo}}, bar: {{bar}}",
})

test.tasks(
  [
    {
      component: class extends Component {
        static definition = { tag: "ui-t-basic" }
      },
      html: "<ui-t-basic></ui-t-basic>",
      def: { type: "ui-t-basic" },
      expected: "<ui-t-basic></ui-t-basic>",
    },

    {
      component: class extends Component {
        static definition = { tag: "ui-t-string" }
        prerender() {
          return "hello"
        }
      },
      html: "<ui-t-string></ui-t-string>",
      def: { type: "ui-t-string" },
      expected: "<ui-t-string>hello</ui-t-string>",
    },

    {
      component: class extends Component {
        static definition = { tag: "ui-t-attr", class: "derp" }
        prerender() {
          return "hello"
        }
      },
      def: { type: "ui-t-attr" },
      expected: '<ui-t-attr class="derp">hello</ui-t-attr>',
    },

    {
      component: {
        tag: "ui-t-data",
        content: "foo: {{foo}}",
      },
      def: {
        content: { type: "ui-t-data" },
        data: { foo: 1 },
      },
      expected: "<ui-t-data>foo: 1</ui-t-data>",
    },

    {
      component(t) {
        const stub = t.stub()
        return class extends Component {
          static definition = {
            tag: "ui-t-signal",
          }

          postrender({ signal }) {
            this.addEventListener("click", stub, { signal })
          }
        }
      },
      def: {
        content: { type: "ui-t-signal" },
      },
      async check(t, app) {
        const el = app.get("ui-t-signal")
        const [stub] = t.stubs
        t.is(stub.count, 0)

        el.click()
        t.is(stub.count, 1)

        el.click()
        t.is(stub.count, 2)

        el.remove()
        el.click()
        t.is(stub.count, 2)

        app.el.append(el)
        await el.ready
        el.click()
        t.is(stub.count, 3)

        el.click()
        t.is(stub.count, 4)

        app.destroy()
        el.click()
        t.is(stub.count, 4)
      },
    },

    {
      def: {
        content: { type: "ui-t-props" },
        data: { foo: 1, bar: 0 },
      },
      expected: '<ui-t-props bar="0">foo: 1, bar: 0</ui-t-props>',
    },

    {
      // only: true,
      def: {
        content: { type: "ui-t-props" },
        data: { foo: 1 },
      },
      expected: '<ui-t-props bar="2">foo: 1, bar: 2</ui-t-props>',
      async check(t, app) {
        const el = app.get("ui-t-props")

        t.is(app.state.get("bar"), 2)

        app.state.set("bar", 3)
        await repaint()

        t.is(
          app.el.innerHTML,
          '<ui-t-props bar="3">foo: 1, bar: 3</ui-t-props>'
        )

        el.bar = 4
        t.is(app.state.get("bar"), 4)
        await repaint()

        t.is(
          app.el.innerHTML,
          '<ui-t-props bar="4">foo: 1, bar: 4</ui-t-props>'
        )

        el.setAttribute("bar", "5")
        t.is(app.state.get("bar"), 5)
        await repaint()

        t.is(
          app.el.innerHTML,
          '<ui-t-props bar="5">foo: 1, bar: 5</ui-t-props>'
        )
      },
    },

    {
      component(t) {
        t.plan(2)
        return class extends Component {
          static definition = {
            tag: "ui-t-filter",
            props: {
              bar: 2,
            },
            content: "foo: {{foo|add5}}, bar: {{bar|add10}}",
          }

          add5(val) {
            return val + 5
          }

          add10(val) {
            t.is(val, 2)
            return val + 10
          }
        }
      },
      def: {
        content: { type: "ui-t-filter" },
        data: { foo: 1 },
      },
      expected: '<ui-t-filter bar="2">foo: 6, bar: 12</ui-t-filter>',
    },

    {
      component: {
        tag: "ui-t-ready",
        content: "ext: {{foo|extname}}",
      },
      def: {
        content: { type: "ui-t-ready" },
        data: { foo: "/42/index.html" },
      },
      expected: "<ui-t-ready>ext: .html</ui-t-ready>",
    },

    {
      component: {
        tag: "ui-t-noprops",
        content: "foo: {{foo}}",
        props: {
          foo: {
            type: "string",
            reflect: true,
          },
        },
      },
      def: {
        content: { type: "ui-t-noprops" },
      },
      expected: "<ui-t-noprops>foo: </ui-t-noprops>",
    },

    {
      component: {
        tag: "ui-t-css",
        props: {
          foo: {
            type: "string",
            css: true,
          },
        },
      },
      def: {
        content: { type: "ui-t-css" /* , foo: "red" */ },
      },
      expected: "<ui-t-css></ui-t-css>",
      async check(t, app) {
        app.state.set("foo", "red")
        await repaint()

        t.is(app.el.innerHTML, '<ui-t-css style="--foo:red;"></ui-t-css>')

        app.state.set("foo", undefined)
        await repaint()

        t.is(app.el.innerHTML, '<ui-t-css style=""></ui-t-css>')

        app.state.set("foo", "blue")
        await repaint()

        t.is(app.el.innerHTML, '<ui-t-css style="--foo:blue;"></ui-t-css>')

        app.state.delete("foo")
        await repaint()

        t.is(app.el.innerHTML, '<ui-t-css style=""></ui-t-css>')
      },
    },
  ],

  ({ title, component, args, html, def, check, expected }) => {
    test.only(title ?? expected ?? def, async (t) => {
      if (component) {
        const fn = await (typeof component === "object" ||
        /^\s*class/.test(component.toString())
          ? Component.define(component)
          : Component.define(component(t)))

        if (args) {
          const el = fn(...args)
          if (expected) t.is(el.outerHTML, expected)
        }
      }

      const app = await ui(div(), def)

      if (expected) t.is(app.el.innerHTML, expected)
      if (check) await check(t, app)

      if (html) {
        const el = div()
        el.innerHTML = html
        t.is(el.innerHTML, expected)
      }
    })
  }
)
