## Extended volar

This is highly experimental version with a lot of benefits to make DX even better out of the box!
I only recommend this for JS-projects, not tested in TS, in TS you can probably stay with Volar.

## Featuring

### Out of the box experience (not configurable yet!)

- Class links / references always work (even without `scope` attribute) [#1038](https://github.com/johnsoncodehk/volar/issues/1038)
- (beta) Support for Vue@2 options API without `defineComponent` or configuring jsconfig. And yes it is much better and stable than builtin `defineComponent` shim support. Even with Vue 2.7! However I know edge-cases where it still fails.
- Adds `()` for methods in completions
- Tries to load webpack aliases automatically
- Vuex v3 support!

### Planned

- Add more settings / switches to disable features
- Return back completions within mixins (mixins itself are supported!)
- Allow callback in Vuex
