# Rationale and references

[日本語](../ja/spec/rationale.md)

<a id="section-16"></a>

## 16. Alternatives not adopted

| Alternative                                       | Reason                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| BNDM/ABNDM as default                             | Short candidates and internal wildcard behavior drive the current design; no measured default advantage.  |
| Unconditional text-length upper filter            | Include/WildcardSpace can accept arbitrarily long texts; only safe bounds apply.                          |
| Persisting all UTF-32/derived EQ/absolute offsets | Increases representation/update coupling; derive runtime structures from validated text instead.          |
| Custom binary patch protocol                      | Base/delta/tombstone and manifests avoid another patch compatibility/validation layer.                    |
| Per-string bulk JS/WASM calls                     | Flat UTF-16 or ASIX reduces boundary calls.                                                               |
| Built-in debounce or learned ranking              | Host responsibilities; the library accepts explicit inputs/order.                                         |
| Optional SIMD/Myers/OSA kernels                   | No unverified feature is advertised or selected by auto; equivalence and controlled benefit are required. |

Position-based deterministic ordering is supported explicitly and is distinct from learned ranking. Server-only analysis does not add a browser tokenizer.

<a id="section-18"></a>

## 18. References

- [Vendored sources, versions and licenses](../../vendor/upstream/README.md)
- [asearch.ts](https://github.com/teramotodaiki/asearch.ts)
- [node-asearch](https://github.com/shokai/node-asearch)
- [asearch-ruby](https://github.com/masui/asearch-ruby): Algorithm provenance; its code is not included.
- [Executable independent models](../../tools/reference/README.md)
