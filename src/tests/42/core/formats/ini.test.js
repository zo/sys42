/* eslint-disable no-proto */
import ini from "../../../../42/core/formats/ini.js"
import parseINI from "../../../../42/core/formats/ini/parseINI.js"
import test from "../../../../42/test.js"

// example from https://github.com/npm/ini#usage
const example = `\
; this comment is being ignored
scope = global

[database]
user = dbuser
password = dbpassword
database = use_this_database

[paths.default]
datadir = /var/lib/data
arr[] = first value
arr[] = second value
arr[] = third value
lastkey = 42
`

const object = {
  scope: "global",
  database: {
    user: "dbuser",
    password: "dbpassword",
    database: "use_this_database",
  },
  paths: {
    default: {
      datadir: "/var/lib/data",
      arr: ["first value", "second value", "third value"],
      lastkey: 42,
    },
  },
}

test("tokenize", (t) => {
  t.eq(parseINI(example), [
    { type: "comment", buffer: "this comment is being ignored" },
    { type: "key", buffer: "scope" },
    { type: "value", buffer: "global" },
    { type: "section", buffer: "database" },
    { type: "key", buffer: "user" },
    { type: "value", buffer: "dbuser" },
    { type: "key", buffer: "password" },
    { type: "value", buffer: "dbpassword" },
    { type: "key", buffer: "database" },
    { type: "value", buffer: "use_this_database" },
    { type: "section", buffer: "paths.default" },
    { type: "key", buffer: "datadir" },
    { type: "value", buffer: "/var/lib/data" },
    { type: "array", buffer: "arr" },
    { type: "value", buffer: "first value" },
    { type: "array", buffer: "arr" },
    { type: "value", buffer: "second value" },
    { type: "array", buffer: "arr" },
    { type: "value", buffer: "third value" },
    { type: "key", buffer: "lastkey" },
    { type: "value", buffer: "42" },
  ])
})

test("decode", (t) => {
  t.alike(ini.decode(example), object)
})

// @src https://github.com/npm/ini/blob/main/test

test.tasks(
  [
    { str: "foo", obj: { foo: true } },
    { str: "foo=string", obj: { foo: "string" } },
    { str: "foo = string", obj: { foo: "string" } },
    { str: "foo\nbar=false", obj: { foo: true, bar: false } },
    { str: "foo\nbar=", obj: { foo: true, bar: undefined } },
    { str: "foo\nbar=\nbaz", obj: { foo: true, bar: undefined, baz: true } },
    {
      str: "foo\nbar=\nbaz=",
      obj: { foo: true, bar: undefined, baz: undefined },
    },
    { str: "[foo]\nbar", obj: { foo: { bar: true } } },
    { str: "[x]\ny=1\nz=2", obj: { x: { y: 1, z: 2 } } },
    { str: "[x]\r\ny=1\r\nz=2", obj: { x: { y: 1, z: 2 } } },
    { str: "[x]\r\ny=1\r\ny[]=2\r\n", obj: { x: { y: [1, 2] } } },
    { str: "=just junk!\r\n[foo]\r\nbar\r\n", obj: { foo: { bar: true } } },
  ],

  (test, { str, obj, tokens }) => {
    test("decode", str, (t) => {
      if (tokens) t.eq(parseINI(str), tokens)
      if (obj) t.alike(ini.decode(str), obj)
    })
  }
)

test.tasks(
  [
    { obj: { foo: true }, str: "foo=true\n" },
    { obj: { foo: 0.1 }, str: "foo=0.1\n" },
    { obj: { foo: null }, str: "foo=null\n" },
    { obj: { foo: undefined }, str: "foo=undefined\n" },
    { obj: { foo: 1 }, str: "foo = 1\n", options: { whitespace: true } },
    { obj: { foo: 1, bar: 2 }, str: "foo=1\nbar=2\n" },
    {
      obj: { foo: 1, bar: 2 },
      str: "foo=1\r\nbar=2\r\n",
      options: { eol: "\r\n" },
    },
    {
      only: true,
      obj: { foo: 0, a: { b: 1, c: { d: 2, e: 3 }, f: 4 }, e: 5 },
      str: "",
    },
  ],

  (test, { str, obj, options }) => {
    test("decode", str, (t) => {
      t.is(ini.encode(obj, options), str)
    })
  }
)

test("proto", (t) => {
  const res = ini.decode(`
__proto__ = quux
constructor.prototype.foo = asdfasdf
foo = baz
[__proto__]
foo = bar
[other]
foo = asdf
[kid.__proto__.foo]
foo = kid
[arrproto]
hello = snyk
__proto__[] = you did a good job
__proto__[] = so you deserve arrays
thanks = true
[ctor.constructor.prototype]
foo = asdfasdf
`)

  t.isUndefined(res.__proto__)
  t.isUndefined(res.kid.__proto__)
  t.isUndefined(res.kid.foo.__proto__)
  t.isUndefined(res.arrproto.__proto__)
  t.isUndefined(Object.prototype.foo)
  t.isUndefined(Object.prototype[0])
  t.isUndefined(Object.prototype["0"])
  t.isUndefined(Object.prototype[1])
  t.isUndefined(Object.prototype["1"])
  t.isUndefined(Array.prototype[0])
  t.isUndefined(Array.prototype[1])

  t.alike(res, {
    "constructor.prototype.foo": "asdfasdf",
    "foo": "baz",
    "other": { foo: "asdf" },
    "kid": { foo: { foo: "kid" } },
    "arrproto": { hello: "snyk", thanks: true },
    "ctor": { constructor: { prototype: { foo: "asdfasdf" } } },
  })
})

// test("encode", (t) => {
//   t.is(ini.encode({foo: {bar: true}}), example)
// })
