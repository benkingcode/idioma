import { describe, it, expect } from 'vitest'
import { compileIcuToFunction, analyzeIcuMessage } from './compiler'

describe('analyzeIcuMessage', () => {
  it('analyzes a simple string message', () => {
    const result = analyzeIcuMessage('Hello world')

    expect(result.hasPlaceholders).toBe(false)
    expect(result.hasPlural).toBe(false)
    expect(result.hasSelect).toBe(false)
    expect(result.variables).toEqual([])
  })

  it('analyzes message with simple placeholder', () => {
    const result = analyzeIcuMessage('Hello {name}')

    expect(result.hasPlaceholders).toBe(true)
    expect(result.variables).toEqual(['name'])
  })

  it('analyzes message with multiple placeholders', () => {
    const result = analyzeIcuMessage('Hello {firstName} {lastName}')

    expect(result.variables).toContain('firstName')
    expect(result.variables).toContain('lastName')
  })

  it('analyzes plural message', () => {
    const result = analyzeIcuMessage('{count, plural, one {# item} other {# items}}')

    expect(result.hasPlural).toBe(true)
    expect(result.variables).toContain('count')
  })

  it('analyzes select message', () => {
    const result = analyzeIcuMessage('{gender, select, male {He} female {She} other {They}}')

    expect(result.hasSelect).toBe(true)
    expect(result.variables).toContain('gender')
  })
})

describe('compileIcuToFunction', () => {
  it('compiles a simple string to a constant', () => {
    const fn = compileIcuToFunction('Hello world', 'en')

    expect(fn({})).toBe('Hello world')
  })

  it('compiles message with placeholder', () => {
    const fn = compileIcuToFunction('Hello {name}', 'en')

    expect(fn({ name: 'World' })).toBe('Hello World')
  })

  it('compiles message with multiple placeholders', () => {
    const fn = compileIcuToFunction('Hello {firstName} {lastName}', 'en')

    expect(fn({ firstName: 'John', lastName: 'Doe' })).toBe('Hello John Doe')
  })

  it('compiles English plural (one/other)', () => {
    const fn = compileIcuToFunction('{count, plural, one {# item} other {# items}}', 'en')

    expect(fn({ count: 1 })).toBe('1 item')
    expect(fn({ count: 5 })).toBe('5 items')
    expect(fn({ count: 0 })).toBe('0 items')
  })

  it('compiles plural with zero form', () => {
    const fn = compileIcuToFunction('{count, plural, zero {no items} one {# item} other {# items}}', 'en')

    expect(fn({ count: 0 })).toBe('no items')
    expect(fn({ count: 1 })).toBe('1 item')
    expect(fn({ count: 5 })).toBe('5 items')
  })

  it('compiles plural with exact values', () => {
    const fn = compileIcuToFunction('{count, plural, =0 {none} =1 {one} other {#}}', 'en')

    expect(fn({ count: 0 })).toBe('none')
    expect(fn({ count: 1 })).toBe('one')
    expect(fn({ count: 42 })).toBe('42')
  })

  it('compiles select message', () => {
    const fn = compileIcuToFunction('{gender, select, male {He} female {She} other {They}}', 'en')

    expect(fn({ gender: 'male' })).toBe('He')
    expect(fn({ gender: 'female' })).toBe('She')
    expect(fn({ gender: 'unknown' })).toBe('They')
  })

  it('compiles combined placeholder and plural', () => {
    const fn = compileIcuToFunction(
      '{name} has {count, plural, one {# message} other {# messages}}',
      'en'
    )

    expect(fn({ name: 'Alice', count: 1 })).toBe('Alice has 1 message')
    expect(fn({ name: 'Bob', count: 5 })).toBe('Bob has 5 messages')
  })

  it('handles Russian plural rules', () => {
    // Russian has: one, few, many, other
    // one: 1, 21, 31... (but not 11)
    // few: 2-4, 22-24, 32-34... (but not 12-14)
    // many: 0, 5-20, 25-30, 35-40... and 11-14
    const fn = compileIcuToFunction(
      '{count, plural, one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщения}}',
      'ru'
    )

    expect(fn({ count: 1 })).toBe('1 сообщение')
    expect(fn({ count: 2 })).toBe('2 сообщения')
    expect(fn({ count: 5 })).toBe('5 сообщений')
    expect(fn({ count: 21 })).toBe('21 сообщение')
    expect(fn({ count: 11 })).toBe('11 сообщений')
  })

  it('handles Arabic plural rules', () => {
    // Arabic has: zero, one, two, few, many, other
    const fn = compileIcuToFunction(
      '{count, plural, zero {لا رسائل} one {رسالة واحدة} two {رسالتان} few {# رسائل} many {# رسالة} other {# رسالة}}',
      'ar'
    )

    expect(fn({ count: 0 })).toBe('لا رسائل')
    expect(fn({ count: 1 })).toBe('رسالة واحدة')
    expect(fn({ count: 2 })).toBe('رسالتان')
  })
})
