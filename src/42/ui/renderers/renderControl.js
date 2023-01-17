/* eslint-disable complexity */

import register from "../register.js"
import render from "../render.js"
import setControlData from "../../fabric/dom/setControlData.js"
import getControlData from "../../fabric/dom/getControlData.js"
import setAttributes from "../../fabric/dom/setAttributes.js"
import create from "../create.js"
import findScope from "../findScope.js"
import resolveScope from "../resolveScope.js"
import getBasename from "../../core/path/core/getBasename.js"
import debounce from "../../fabric/type/function/debounce.js"
import toTitleCase from "../../fabric/type/string/case/toTitleCase.js"
import hash from "../../fabric/type/any/hash.js"
import { objectifyPlan } from "../normalize.js"

const TEXTBOX_TYPES = new Set(["text", "email", "search"])

function setValidation(plan, { localName, type }) {
  const attr = {}
  if (plan.required) attr.required = true
  if (plan.schema) {
    const { schema } = plan
    // string
    if ("pattern" in schema) attr.pattern = schema.pattern
    if ("minLength" in schema) attr.minLength = schema.minLength
    if ("maxLength" in schema) attr.maxLength = schema.maxLength

    // number
    if ("multipleOf" in schema) attr.step = schema.multipleOf
    if ("exclusiveMinimum" in schema) attr.min = schema.exclusiveMinimum + 1
    else if ("minimum" in schema) attr.min = schema.minimum
    if ("exclusiveMaximum" in schema) attr.max = schema.exclusiveMaximum - 1
    else if ("maximum" in schema) attr.max = schema.maximum
  }

  if (
    localName === "textarea" ||
    (localName === "input" && TEXTBOX_TYPES.has(type))
  ) {
    attr.autocomplete = plan.autocomplete ?? "off" // opt-in autocomplete
    if (plan.prose !== true) {
      attr.autocapitalize = "none"
      attr.autocorrect = "off"
      attr.spellcheck = "false"
      attr.translate = "no"
    }
  }

  return attr
}

function getBindScope(stage, bind) {
  return resolveScope(...findScope(stage, bind), stage)
}

export default function renderControl(el, stage, plan) {
  el.id ||= hash(stage.steps)

  if (plan.bind) {
    let scopeFrom
    let scopeTo
    if (plan.bind.from) {
      scopeFrom = getBindScope(stage, plan.bind.from)
      register(stage, scopeFrom, async (val) => setControlData(el, await val))
    }

    if (plan.bind.to) {
      scopeTo =
        plan.bind.to === plan.bind.from
          ? scopeFrom
          : getBindScope(stage, plan.bind.to)

      const fn = () => stage.reactive.set(scopeTo, getControlData(el))

      plan.on ??= []
      plan.on.push(
        plan.lazy
          ? {
              [plan.enterKeyHint === "enter"
                ? "change || Control+s"
                : "change || Control+s || Enter"]: fn,
            }
          : plan.debounce
          ? {
              input: debounce(fn, plan.debounce),
              [plan.enterKeyHint === "enter"
                ? "change || Control+s"
                : "change || Control+s || Enter"]: fn,
            }
          : { input: fn }
      )
    }

    if (el.type === "radio") {
      el.value = plan.value
      el.checked = plan.checked
    }

    if (scopeTo) {
      if (el.type === "radio") {
        if (plan.checked) stage.reactive.set(scopeTo, plan.value)
      } else if ("value" in plan) {
        stage.reactive.set(scopeTo, plan.value)
      }
    }

    const name = scopeTo ?? scopeFrom
    if (name) el.name ||= name
  }

  setAttributes(el, setValidation(plan, el))

  const labelPlan =
    plan.label ??
    (el.type === "radio"
      ? toTitleCase(el.value)
      : toTitleCase(getBasename(el.name)))

  const role = el.getAttribute("role")

  if (role === "menuitemcheckbox" || role === "menuitemradio") {
    const label = render(
      {
        tag: "label",
        for: el.id,
        role: "none",
        ...objectifyPlan(labelPlan),
      },
      stage
    )
    label.prepend(el)
    return label
  }

  const isCheckField = el.type === "radio" || el.type === "checkbox"

  const field = isCheckField
    ? create(".check-cont")
    : document.createDocumentFragment()

  if (labelPlan) {
    el.removeAttribute("label")

    const tag = stage.parent?.classList.contains("toggle-group")
      ? "label.button"
      : "label"

    const label = render(
      {
        tag,
        for: el.id,
        ...objectifyPlan(labelPlan),
      },
      stage
    )

    if (plan.compact === true) label.classList.add("sr-only")

    if (plan.required) {
      label.append(
        create("abbr", { "aria-hidden": "true", "title": "Required" }, "*")
      )
    }

    field.append(label)
  }

  if (isCheckField) field.prepend(el)
  else field.append(el)

  return field
}
