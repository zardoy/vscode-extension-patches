import { expectType } from 'tsd'

const describe = (desc: string, cb: any) => cb()

describe('type inference w/ options API', () => {
  defineComponent({
      data: () => ({
          test: 5,
      }),
      methods: {
          test5() {
              this
          },
      },
      computed: {
          test() {},
      },
      props: {
          test6: {
              type: String,
          },
      },
  })
    defineComponent({
        props: {
            myProp: {
                type: Number,
                validator(val: unknown): boolean {
                    // @ts-expect-error
                    return val !== this.otherProp
                },
                default(): number {
                    // @ts-expect-error
                    return this.otherProp + 1
                },
            },
            otherProp: {
                type: Number,
                required: true,
            },
        },
    })
    defineComponent({
        props: { a: Number },
        data() {
            // Limitation: we cannot expose the return result of setup() on `this`
            // here in data() - somehow that would mess up the inference
            expectType<number | undefined>(this.a)
            return {
                c: this.a || 123,
            }
        },
        computed: {
            d() {
                expectType<number>(this.b)
                return this.b + 1
            },
            e: {
                get() {
                    expectType<number>(this.b)
                    expectType<number>(this.d)

                    return this.b + this.d
                },
                set(v: number) {
                    expectType<number>(this.b)
                    expectType<number>(this.d)
                    expectType<number>(v)
                },
            },
        },
        watch: {
            a() {
                expectType<number>(this.b)
                this.b + 1
            },
        },
        created() {
            // props
            expectType<number | undefined>(this.a)
            // returned from setup()
            expectType<number>(this.b)
            // returned from data()
            expectType<number>(this.c)
            // computed
            expectType<number>(this.d)
            // computed get/set
            expectType<number>(this.e)
            expectType<number>(this.someRef)
        },
        methods: {
            doSomething() {
                // props
                expectType<number | undefined>(this.a)
                // returned from setup()
                expectType<number>(this.b)
                // returned from data()
                expectType<number>(this.c)
                // computed
                expectType<number>(this.d)
                // computed get/set
                expectType<number>(this.e)
            },
            returnSomething() {
                return this.a
            },
        },
        render() {
            // props
            expectType<number | undefined>(this.a)
            // returned from setup()
            expectType<number>(this.b)
            // returned from data()
            expectType<number>(this.c)
            // computed
            expectType<number>(this.d)
            // computed get/set
            expectType<number>(this.e)
            // method
            expectType<() => number | undefined>(this.returnSomething)
        },
    })
})

describe('with mixins', () => {
    const MixinA = defineComponent({
        emits: ['bar'],
        props: {
            aP1: {
                type: String,
                default: 'aP1',
            },
            aP2: Boolean,
        },
        data() {
            return {
                a: 1,
            }
        },
    })
    const MixinB = defineComponent({
        props: ['bP1', 'bP2'],
        data() {
            return {
                b: 2,
            }
        },
    })
    const MixinC = defineComponent({
        data() {
            return {
                c: 3,
            }
        },
    })
    const MixinD = defineComponent({
        mixins: [MixinA],
        data() {
            //@ts-expect-error computed are not available on data()
            expectError<number>(this.dC1)
            //@ts-expect-error computed are not available on data()
            expectError<string>(this.dC2)

            return {
                d: 4,
            }
        },
        setup(props) {
            expectType<string>(props.aP1)
        },
        computed: {
            dC1() {
                return this.d + this.a
            },
            dC2() {
                return this.aP1 + 'dC2'
            },
        },
    })
    const MyComponent = defineComponent({
        mixins: [MixinA, MixinB, MixinC, MixinD],
        emits: ['click'],
        props: {
            // required should make property non-void
            z: {
                type: String,
                required: true,
            },
        },

        data(vm) {
            expectType<number>(vm.a)
            expectType<number>(vm.b)
            expectType<number>(vm.c)
            expectType<number>(vm.d)

            // should also expose declared props on `this`
            expectType<number>(this.a)
            expectType<string>(this.aP1)
            expectType<boolean | undefined>(this.aP2)
            expectType<number>(this.b)
            expectType<any>(this.bP1)
            expectType<number>(this.c)
            expectType<number>(this.d)

            return {}
        },

        setup(props) {
            expectType<string>(props.z)
            // props
            expectType<((...args: any[]) => any) | undefined>(props.onClick)
            // from Base
            expectType<((...args: any[]) => any) | undefined>(props.onBar)
            expectType<string>(props.aP1)
            expectType<boolean | undefined>(props.aP2)
            expectType<any>(props.bP1)
            expectType<any>(props.bP2)
            expectType<string>(props.z)
        },
        render() {
            const props = this.$props
            // props
            expectType<((...args: any[]) => any) | undefined>(props.onClick)
            // from Base
            expectType<((...args: any[]) => any) | undefined>(props.onBar)
            expectType<string>(props.aP1)
            expectType<boolean | undefined>(props.aP2)
            expectType<any>(props.bP1)
            expectType<any>(props.bP2)
            expectType<string>(props.z)

            const data = this.$data
            expectType<number>(data.a)
            expectType<number>(data.b)
            expectType<number>(data.c)
            expectType<number>(data.d)

            // should also expose declared props on `this`
            expectType<number>(this.a)
            expectType<string>(this.aP1)
            expectType<boolean | undefined>(this.aP2)
            expectType<number>(this.b)
            expectType<any>(this.bP1)
            expectType<number>(this.c)
            expectType<number>(this.d)
            expectType<number>(this.dC1)
            expectType<string>(this.dC2)

            // props should be readonly
            // @ts-expect-error
            expectError((this.aP1 = 'new'))
            // @ts-expect-error
            expectError((this.z = 1))

            // props on `this` should be readonly
            // @ts-expect-error
            expectError((this.bP1 = 1))

            // string value can not assigned to number type value
            // @ts-expect-error
            expectError((this.c = '1'))

            // setup context properties should be mutable
            this.d = 5

            return null
        },
    })

    // Test TSX
    expectType<JSX.Element>(<MyComponent aP1={'aP'} aP2 bP1={1} bP2={[1, 2]} z={'z'} />)

    // missing required props
    // @ts-expect-error
    expectError(<MyComponent />)

    // wrong prop types
    // @ts-expect-error
    expectError(<MyComponent aP1="ap" aP2={'wrong type'} bP1="b" z={'z'} />)
    // @ts-expect-error
    expectError(<MyComponent aP1={1} bP2={[1]} />)
})

describe('with extends', () => {
    const Base = defineComponent({
        props: {
            aP1: Boolean,
            aP2: {
                type: Number,
                default: 2,
            },
        },
        data() {
            return {
                a: 1,
            }
        },
        computed: {
            c(): number {
                return this.aP2 + this.a
            },
        },
    })
    const MyComponent = defineComponent({
        extends: Base,
        props: {
            // required should make property non-void
            z: {
                type: String,
                required: true,
            },
        },
        render() {
            const props = this.$props
            // props
            expectType<boolean | undefined>(props.aP1)
            expectType<number>(props.aP2)
            expectType<string>(props.z)

            const data = this.$data
            expectType<number>(data.a)

            // should also expose declared props on `this`
            expectType<number>(this.a)
            expectType<boolean | undefined>(this.aP1)
            expectType<number>(this.aP2)

            // setup context properties should be mutable
            this.a = 5

            return null
        },
    })

    // Test TSX
    expectType<JSX.Element>(<MyComponent aP2={3} aP1 z={'z'} />)

    // missing required props
    // @ts-expect-error
    expectError(<MyComponent />)

    // wrong prop types
    // @ts-expect-error
    expectError(<MyComponent aP2={'wrong type'} z={'z'} />)
    // @ts-expect-error
    expectError(<MyComponent aP1={3} />)
})

describe('extends with mixins', () => {
    const Mixin = defineComponent({
        emits: ['bar'],
        props: {
            mP1: {
                type: String,
                default: 'mP1',
            },
            mP2: Boolean,
            mP3: {
                type: Boolean,
                required: true,
            },
        },
        data() {
            return {
                a: 1,
            }
        },
    })
    const Base = defineComponent({
        emits: ['foo'],
        props: {
            p1: Boolean,
            p2: {
                type: Number,
                default: 2,
            },
            p3: {
                type: Boolean,
                required: true,
            },
        },
        data() {
            return {
                b: 2,
            }
        },
        computed: {
            c(): number {
                return this.p2 + this.b
            },
        },
    })
    const MyComponent = defineComponent({
        extends: Base,
        mixins: [Mixin],
        emits: ['click'],
        props: {
            // required should make property non-void
            z: {
                type: String,
                required: true,
            },
        },
        render() {
            const props = this.$props
            // props
            expectType<((...args: any[]) => any) | undefined>(props.onClick)
            // from Mixin
            expectType<((...args: any[]) => any) | undefined>(props.onBar)
            // from Base
            expectType<((...args: any[]) => any) | undefined>(props.onFoo)
            expectType<boolean | undefined>(props.p1)
            expectType<number>(props.p2)
            expectType<string>(props.z)
            expectType<string>(props.mP1)
            expectType<boolean | undefined>(props.mP2)

            const data = this.$data
            expectType<number>(data.a)
            expectType<number>(data.b)

            // should also expose declared props on `this`
            expectType<number>(this.a)
            expectType<number>(this.b)
            expectType<boolean | undefined>(this.p1)
            expectType<number>(this.p2)
            expectType<string>(this.mP1)
            expectType<boolean | undefined>(this.mP2)

            // setup context properties should be mutable
            this.a = 5

            return null
        },
    })

    // Test TSX
    expectType<JSX.Element>(<MyComponent mP1="p1" mP2 mP3 p1 p2={1} p3 z={'z'} />)

    // mP1, mP2, p1, and p2 have default value. these are not required
    expectType<JSX.Element>(<MyComponent mP3 p3 z={'z'} />)

    // missing required props
    // @ts-expect-error
    expectError(<MyComponent mP3 p3 /* z='z' */ />)
    // missing required props from mixin
    // @ts-expect-error
    expectError(<MyComponent /* mP3 */ p3 z="z" />)
    // missing required props from extends
    // @ts-expect-error
    expectError(<MyComponent mP3 /* p3 */ z="z" />)

    // wrong prop types
    // @ts-expect-error
    expectError(<MyComponent p2={'wrong type'} z={'z'} />)
    // @ts-expect-error
    expectError(<MyComponent mP1={3} />)

    // #3468
    const CompWithD = defineComponent({
        data() {
            return { foo: 1 }
        },
    })
    const CompWithC = defineComponent({
        computed: {
            foo() {
                return 1
            },
        },
    })
    const CompWithM = defineComponent({ methods: { foo() {} } })
    const CompEmpty = defineComponent({})

    defineComponent({
        mixins: [CompWithD, CompEmpty],
        mounted() {
            expectType<number>(this.foo)
        },
    })
    defineComponent({
        mixins: [CompWithC, CompEmpty],
        mounted() {
            expectType<number>(this.foo)
        },
    })
    defineComponent({
        mixins: [CompWithM, CompEmpty],
        mounted() {
            expectType<() => void>(this.foo)
        },
    })
})

describe('compatibility w/ createApp', () => {
    const comp = defineComponent({})
    createApp(comp).mount('#hello')

    const comp2 = defineComponent({
        props: { foo: String },
    })
    createApp(comp2).mount('#hello')

    const comp3 = defineComponent({
        setup() {
            return {
                a: 1,
            }
        },
    })
    createApp(comp3).mount('#hello')
})

describe('defineComponent', () => {
    test('should accept components defined with defineComponent', () => {
        const comp = defineComponent({})
        defineComponent({
            components: { comp },
        })
    })

    test('should accept class components with receiving constructor arguments', () => {
        class Comp {
            static __vccOpts = {}
            constructor(_props: { foo: string }) {}
        }
        defineComponent({
            components: { Comp },
        })
    })
})

describe('emits', () => {
    // Note: for TSX inference, ideally we want to map emits to onXXX props,
    // but that requires type-level string constant concatenation as suggested in
    // https://github.com/Microsoft/TypeScript/issues/12754

    // The workaround for TSX users is instead of using emits, declare onXXX props
    // and call them instead. Since `v-on:click` compiles to an `onClick` prop,
    // this would also support other users consuming the component in templates
    // with `v-on` listeners.

    // with object emits
    defineComponent({
        emits: {
            click: (n: number) => typeof n === 'number',
            input: (b: string) => b.length > 1,
        },
        setup(props, { emit }) {
            expectType<((n: number) => boolean) | undefined>(props.onClick)
            expectType<((b: string) => boolean) | undefined>(props.onInput)
            emit('click', 1)
            emit('input', 'foo')
            //  @ts-expect-error
            expectError(emit('nope'))
            //  @ts-expect-error
            expectError(emit('click'))
            //  @ts-expect-error
            expectError(emit('click', 'foo'))
            //  @ts-expect-error
            expectError(emit('input'))
            //  @ts-expect-error
            expectError(emit('input', 1))
        },
        created() {
            this.$emit('click', 1)
            this.$emit('input', 'foo')
            //  @ts-expect-error
            expectError(this.$emit('nope'))
            //  @ts-expect-error
            expectError(this.$emit('click'))
            //  @ts-expect-error
            expectError(this.$emit('click', 'foo'))
            //  @ts-expect-error
            expectError(this.$emit('input'))
            //  @ts-expect-error
            expectError(this.$emit('input', 1))
        },
        mounted() {
            // #3599
            this.$nextTick(function () {
                // this should be bound to this instance

                this.$emit('click', 1)
                this.$emit('input', 'foo')
                //  @ts-expect-error
                expectError(this.$emit('nope'))
                //  @ts-expect-error
                expectError(this.$emit('click'))
                //  @ts-expect-error
                expectError(this.$emit('click', 'foo'))
                //  @ts-expect-error
                expectError(this.$emit('input'))
                //  @ts-expect-error
                expectError(this.$emit('input', 1))
            })
        },
    })

    // with array emits
    defineComponent({
        emits: ['foo', 'bar'],
        setup(props, { emit }) {
            expectType<((...args: any[]) => any) | undefined>(props.onFoo)
            expectType<((...args: any[]) => any) | undefined>(props.onBar)
            emit('foo')
            emit('foo', 123)
            emit('bar')
            //  @ts-expect-error
            expectError(emit('nope'))
        },
        created() {
            this.$emit('foo')
            this.$emit('foo', 123)
            this.$emit('bar')
            //  @ts-expect-error
            expectError(this.$emit('nope'))
        },
    })

    // with tsx
    const Component = defineComponent({
        emits: {
            click: (n: number) => typeof n === 'number',
        },
        setup(props, { emit }) {
            expectType<((n: number) => any) | undefined>(props.onClick)
            emit('click', 1)
            //  @ts-expect-error
            expectError(emit('click'))
            //  @ts-expect-error
            expectError(emit('click', 'foo'))
        },
    })

    defineComponent({
        render() {
            return (
                <Component
                    onClick={(n: number) => {
                        return n + 1
                    }}
                />
            )
        },
    })

    // without emits
    defineComponent({
        setup(props, { emit }) {
            emit('test', 1)
            emit('test')
        },
    })

    // emit should be valid when ComponentPublicInstance is used.
    const instance = {} as ComponentPublicInstance
    instance.$emit('test', 1)
    instance.$emit('test')

    // `this` should be void inside of emits validators
    defineComponent({
        props: ['bar'],
        emits: {
            foo(): boolean {
                // @ts-expect-error
                return this.bar === 3
            },
        },
    })
})

describe('componentOptions setup should be `SetupContext`', () => {
    expectType<ComponentOptions['setup']>({} as (props: Record<string, any>, ctx: SetupContext) => any)
})

describe('extract instance type', () => {
    const Base = defineComponent({
        props: {
            baseA: {
                type: Number,
                default: 1,
            },
        },
    })
    const MixinA = defineComponent({
        props: {
            mA: {
                type: String,
                default: '',
            },
        },
    })
    const CompA = defineComponent({
        extends: Base,
        mixins: [MixinA],
        props: {
            a: {
                type: Boolean,
                default: false,
            },
            b: {
                type: String,
                required: true,
            },
            c: Number,
        },
    })

    const compA = {} as InstanceType<typeof CompA>

    expectType<boolean>(compA.a)
    expectType<string>(compA.b)
    expectType<number | undefined>(compA.c)
    // mixins
    expectType<string>(compA.mA)
    // extends
    expectType<number>(compA.baseA)

    //  @ts-expect-error
    expectError((compA.a = true))
    //  @ts-expect-error
    expectError((compA.b = 'foo'))
    //  @ts-expect-error
    expectError((compA.c = 1))
    //  @ts-expect-error
    expectError((compA.mA = 'foo'))
    //  @ts-expect-error
    expectError((compA.baseA = 1))
})


// #5948
describe('DefineComponent should infer correct types when assigning to Component', () => {
    let component: Component
    component = defineComponent({
        setup(_, { attrs, slots }) {
            // @ts-expect-error should not be any
            expectType<[]>(attrs)
            // @ts-expect-error should not be any
            expectType<[]>(slots)
        },
    })
    expectType<Component>(component)
})

// #5969
describe('should allow to assign props', () => {
    const Child = defineComponent({
        props: {
            bar: String,
        },
    })

    const Parent = defineComponent({
        props: {
            ...Child.props,
            foo: String,
        },
    })

    const child = new Child()
    expectType<JSX.Element>(<Parent {...child.$props} />)
})

// #6052
describe('prop starting with `on*` is broken', () => {
    defineComponent({
        props: {
            onX: {
                type: Function as PropType<(a: 1) => void>,
                required: true,
            },
        },
        methods: {
          test() {
            this
          }
        }
    })

    defineComponent({
        props: {
            onX: {
                type: Function as PropType<(a: 1) => void>,
                required: true,
            },
        },
        emits: {
            test: (a: 1) => true,
        },
        setup(props) {
            expectType<(a: 1) => void>(props.onX)
            expectType<undefined | ((a: 1) => any)>(props.onTest)
        },
    })
})