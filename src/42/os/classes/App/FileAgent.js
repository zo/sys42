import isHashmapLike from "../../../fabric/type/any/is/isHashmapLike.js"
import isInstanceOf from "../../../fabric/type/any/is/isInstanceOf.js"
import getBasename from "../../../core/path/core/getBasename.js"
import disk from "../../../core/disk.js"

const _noSideEffects = Symbol("FileAgent._noSideEffects")
const _path = Symbol("FileAgent._path")
const _url = Symbol("FileAgent._url")
const _blob = Symbol("FileAgent._blob")
const _data = Symbol("FileAgent._data")

const dummyBlob = Promise.resolve(new Blob())

export default class FileAgent {
  [Symbol.for("observe")] = true

  static recycle(obj, key, init, manifest) {
    if (key in obj) obj[key].init(init)
    else obj[key] = new FileAgent(init, manifest)
  }

  constructor(init, manifest) {
    this.manifest = manifest
    this.init(init)
  }

  init(init) {
    this[_noSideEffects] = false
    const type = typeof init
    if (type === "string") {
      this.path = init
    } else if (isHashmapLike(init)) {
      if ("id" in init) this.id = init.id
      if ("path" in init) this.path = init.path
      if ("data" in init) this.data = init.data
      if ("dirty" in init) this.dirty = init.dirty
    } else if (isInstanceOf(init, Blob)) {
      this[_noSideEffects] = true
      this.path = undefined
      this[_noSideEffects] = false
      this.name = init.name
      this.data = init
    } else {
      this.path = undefined
    }
  }

  get path() {
    return this[_path]
  }
  set path(val) {
    this[_path] = val
    if (this[_noSideEffects]) return
    this.name = val ? getBasename(val) : undefined
    this.data = undefined
    this.dirty = undefined
  }

  get data() {
    if (this[_blob]) return Promise.resolve(this[_blob])
    if (this[_data]) {
      this[_blob] = new Blob([this[_data]])
      return Promise.resolve(this[_blob])
    }

    if (!this.path) return dummyBlob

    return import("../../../core/fs.js") //
      .then(({ default: fs }) => fs.open(this.path))
      .then((blob) => {
        this[_blob] = blob
        return this[_blob]
      })
  }
  set data(data) {
    this[_data] = data
    this[_blob] = undefined
    if (this[_noSideEffects]) return
    this.url = undefined
    this.text = undefined
    this.stream = undefined
    this.dirty = true
  }

  get url() {
    if (this[_url]) return this[_url]

    return (async () => {
      if (this.path) {
        const { id } = await disk.getIdAndMask(this.path)
        if (id === 0) {
          this[_url] = this.path
          return this[_url]
        }
      }

      const blob = await this.data
      this[_url] = URL.createObjectURL(blob)
      return this[_url]
    })()
  }
  set url(val) {
    if (this[_url]) URL.revokeObjectURL(this[_url])
    this[_url] = undefined
  }

  get stream() {
    if (this[_blob]) return this[_blob].stream()
    return this.data.then((blob) => blob.stream())
  }
  set stream(val) {}

  get text() {
    if (this[_blob]) return this[_blob].text()
    return this.data.then((blob) => blob.text())
  }
  set text(val) {}

  destroy() {
    this.path = undefined
  }

  toJSON() {
    return {
      id: this.id,
      path: this.path,
      dirty: this.dirty,
      data: this[_data],
    }
  }
}
