import separate from "../type/string/separate.js"

export default function deallocate(obj, loc, delimiter = ".") {
  return deallocate.run(obj, separate(loc, delimiter))
}

deallocate.separate = separate

deallocate.run = (obj, segments) => {
  let current = obj

  if (segments.length === 0) {
    for (const key in obj) if (Object.hasOwn(obj, key)) delete obj[key]
    return obj
  }

  for (let i = 0, l = segments.length; i < l; i++) {
    const key = segments[i]
    if (typeof current !== "object" || key in current === false) return obj

    if (segments.length - 1 === i) {
      delete current[key]
      return obj
    }

    current = current[key]
  }

  return obj
}
