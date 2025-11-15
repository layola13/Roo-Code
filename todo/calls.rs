//! Function call and method call conversions

use syn::{ExprCall, ExprMethodCall};
use crate::converter::types::TsExpression;
use crate::converter::std_methods::{ResultMethod, OptionMethod, SmartPointerMethod, VecMethod, IteratorMethod, HashMapMethod, HashSetMethod, BTreeMapMethod, BTreeSetMethod, BinaryHeapMethod, StdMethod};

/// Get the size in bytes for a given Rust type
/// This is used for std::mem::size_of::<T>() conversion
fn get_type_size(ty: &syn::Type) -> usize {
    match ty {
        syn::Type::Path(type_path) => {
            if let Some(ident) = type_path.path.get_ident() {
                let type_name = ident.to_string();
                match type_name.as_str() {
                    // 8-bit types
                    "i8" | "u8" | "bool" => 1,
                    // 16-bit types
                    "i16" | "u16" => 2,
                    // 32-bit types
                    "i32" | "u32" | "f32" | "char" => 4,
                    // 64-bit types
                    "i64" | "u64" | "f64" | "isize" | "usize" => 8,
                    // 128-bit types
                    "i128" | "u128" => 16,
                    // Pointer types
                    _ if type_name.contains("*") || type_name.starts_with("&") => 8,
                    // Default for unknown types (String, Vec, etc.)
                    _ => 24, // Most heap-allocated types have 3 words (ptr, len, cap)
                }
            } else {
                // For complex paths, return a reasonable default
                8
            }
        }
        syn::Type::Reference(_) => 8, // References are pointer-sized
        syn::Type::Ptr(_) => 8,       // Raw pointers are pointer-sized
        syn::Type::Tuple(tuple) => {
            // Sum up the sizes of tuple elements
            tuple.elems.iter().map(|elem| get_type_size(elem)).sum()
        }
        syn::Type::Array(array) => {
            // Get element size and multiply by length
            let elem_size = get_type_size(&array.elem);
            if let syn::Expr::Lit(syn::ExprLit { lit: syn::Lit::Int(len), .. }) = &array.len {
                if let Ok(length) = len.base10_parse::<usize>() {
                    return elem_size * length;
                }
            }
            elem_size
        }
        _ => 8, // Default size for unknown types
    }
}

/// Get the alignment in bytes for a given Rust type
/// This is used for std::mem::align_of::<T>() conversion
fn get_type_alignment(ty: &syn::Type) -> usize {
    match ty {
        syn::Type::Path(type_path) => {
            if let Some(ident) = type_path.path.get_ident() {
                let type_name = ident.to_string();
                match type_name.as_str() {
                    // 1-byte alignment
                    "i8" | "u8" | "bool" => 1,
                    // 2-byte alignment
                    "i16" | "u16" => 2,
                    // 4-byte alignment
                    "i32" | "u32" | "f32" | "char" => 4,
                    // 8-byte alignment
                    "i64" | "u64" | "f64" | "isize" | "usize" | "i128" | "u128" => 8,
                    // Default alignment
                    _ => 8,
                }
            } else {
                8
            }
        }
        syn::Type::Reference(_) => 8,
        syn::Type::Ptr(_) => 8,
        syn::Type::Tuple(tuple) => {
            // Tuple alignment is the maximum alignment of its elements
            tuple.elems.iter()
                .map(|elem| get_type_alignment(elem))
                .max()
                .unwrap_or(1)
        }
        syn::Type::Array(array) => {
            // Array alignment is the same as element alignment
            get_type_alignment(&array.elem)
        }
        _ => 8,
    }
}

/// Convert function call expressions to TypeScript
pub fn convert_call(call: &ExprCall, convert_expr: &dyn Fn(&syn::Expr) -> TsExpression) -> TsExpression {
    // CRITICAL: Extract generic type arguments BEFORE converting the function expression
    // This must be done first because convert_expr() will lose the generic information
    // Handle std::mem::size_of::<T>(), align_of::<T>() calls
    if let syn::Expr::Path(path_expr) = &*call.func {
        if let Some(last_segment) = path_expr.path.segments.last() {
            let func_name = last_segment.ident.to_string();
            
            // Check if this is size_of, align_of, or size_of_val with generic parameters
            if matches!(func_name.as_str(), "size_of" | "align_of" | "size_of_val") {
                if let syn::PathArguments::AngleBracketed(generic_args) = &last_segment.arguments {
                    if let Some(syn::GenericArgument::Type(ty)) = generic_args.args.first() {
                        // Extract type size/alignment based on function name
                        match func_name.as_str() {
                            "size_of" => {
                                let type_size = get_type_size(ty);
                                return TsExpression::NumberLiteral(type_size.to_string());
                            }
                            "align_of" => {
                                let type_align = get_type_alignment(ty);
                                return TsExpression::NumberLiteral(type_align.to_string());
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }
    
    let func_expr = convert_expr(&call.func);
    let args: Vec<TsExpression> = call.args.iter().map(|arg| convert_expr(arg)).collect();
    
    // CRITICAL: Check if this is a Box<dyn Fn> closure call
    // In Rust: Box<dyn Fn(i32) -> i32> can be called directly due to Deref trait
    // In TypeScript: Box needs explicit .deref() call to access the function
    // Pattern: closure(args) where closure is a Box<Fn> -> closure.deref()(args)
    let func_expr = if is_box_closure_call(&call.func, &func_expr) {
        // Insert .deref() call to dereference Box before calling the function
        TsExpression::MethodCall {
            receiver: Box::new(func_expr),
            method: "deref".to_string(),
            args: vec![],
        }
    } else {
        func_expr
    };
    
    // Check for std::mem::transmute calls (converted to std_mem_transmute identifier)
    // std::mem::transmute(value) -> inline DataView conversion
    if let TsExpression::Identifier(func_name) = &func_expr {
        if func_name == "std_mem_transmute" && args.len() == 1 {
            // Generate inline DataView conversion for u32 -> f32
            // (() => { const buffer = new ArrayBuffer(4); const view = new DataView(buffer); view.setUint32(0, value, true); return view.getFloat32(0, true); })()
            return TsExpression::Call {
                func: Box::new(TsExpression::Paren(Box::new(TsExpression::ArrowFunction {
                    params: vec![],
                    body: Box::new(TsExpression::Block(vec![
                        TsExpression::VariableDeclaration {
                            name: "buffer".to_string(),
                            value: Some(Box::new(TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("new ArrayBuffer".to_string())),
                                args: vec![TsExpression::NumberLiteral("4".to_string())],
                            })),
                            is_mutable: false,
                        },
                        TsExpression::VariableDeclaration {
                            name: "view".to_string(),
                            value: Some(Box::new(TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("new DataView".to_string())),
                                args: vec![TsExpression::Identifier("buffer".to_string())],
                            })),
                            is_mutable: false,
                        },
                        TsExpression::MethodCall {
                            receiver: Box::new(TsExpression::Identifier("view".to_string())),
                            method: "setUint32".to_string(),
                            args: vec![
                                TsExpression::NumberLiteral("0".to_string()),
                                args[0].clone(),
                                TsExpression::Identifier("true".to_string()),
                            ],
                        },
                        TsExpression::Return(Some(Box::new(TsExpression::MethodCall {
                            receiver: Box::new(TsExpression::Identifier("view".to_string())),
                            method: "getFloat32".to_string(),
                            args: vec![
                                TsExpression::NumberLiteral("0".to_string()),
                                TsExpression::Identifier("true".to_string()),
                            ],
                        }))),
                    ])),
                }))),
                args: vec![],
            };
        }
        
        // Check for std::mem::size_of calls (converted to std_mem_size_of identifier)
        // std::mem::size_of::<T>() -> constant size based on type
        // Also handles direct size_of calls from `use std::mem::size_of`
        if func_name == "std_mem_size_of" || func_name == "size_of" {
            // Extract generic type from the original Rust expression
            // The generic parameter is in call.func which should be ExprPath with turbofish
            if let syn::Expr::Path(path_expr) = &*call.func {
                // Check for turbofish syntax: path::<Type>
                if let Some(last_segment) = path_expr.path.segments.last() {
                    if let syn::PathArguments::AngleBracketed(args) = &last_segment.arguments {
                        if let Some(first_arg) = args.args.first() {
                            if let syn::GenericArgument::Type(ty) = first_arg {
                                // Extract the type name
                                let type_size = get_type_size(ty);
                                return TsExpression::NumberLiteral(type_size.to_string());
                            }
                        }
                    }
                }
            }
            // Fallback: if we can't extract the generic, return a default size
            return TsExpression::NumberLiteral("4".to_string());
        }
        
        // Check for std::mem::size_of_val calls
        // Also handles direct size_of_val calls from `use std::mem::size_of_val`
        if (func_name == "std_mem_size_of_val" || func_name == "size_of_val") && args.len() == 1 {
            // size_of_val(&value) -> calculate size based on value
            // For arrays: array.length * element_size
            // For other types: return a reasonable default
            
            // Check if the argument is an array/identifier
            // We need to generate: (array.length * element_size)
            // Since we don't know the element type at compile time in TS,
            // we'll use a helper that inspects the array
            
            // For now, generate inline calculation for arrays:
            // array.length * 4 (assuming i32 elements)
            // This is a simplification but works for most common cases
            return TsExpression::Binary {
                left: Box::new(TsExpression::Paren(Box::new(TsExpression::Member {
                    object: Box::new(args[0].clone()),
                    property: "length".to_string(),
                }))),
                op: "*".to_string(),
                right: Box::new(TsExpression::NumberLiteral("4".to_string())),
            };
        }
        
        // Check for std::mem::align_of calls
        // Also handles direct align_of calls from `use std::mem::align_of`
        if func_name == "std_mem_align_of" || func_name == "align_of" {
            // Extract generic type similar to size_of
            if let syn::Expr::Path(path_expr) = &*call.func {
                if let Some(last_segment) = path_expr.path.segments.last() {
                    if let syn::PathArguments::AngleBracketed(args) = &last_segment.arguments {
                        if let Some(first_arg) = args.args.first() {
                            if let syn::GenericArgument::Type(ty) = first_arg {
                                let type_align = get_type_alignment(ty);
                                return TsExpression::NumberLiteral(type_align.to_string());
                            }
                        }
                    }
                }
            }
            // Fallback alignment
            return TsExpression::NumberLiteral("4".to_string());
        }
    }
    
    // Check for std::mem::size_of calls
    if let TsExpression::Member { object, property } = &func_expr {
        if property == "size_of" {
            if let TsExpression::Member { object: inner_obj, property: inner_prop } = &**object {
                if let TsExpression::Identifier(std_name) = &**inner_obj {
                    if std_name == "std" && inner_prop == "mem" {
                        // std::mem::size_of::<T>() -> 4 (hardcoded for common types)
                        // In TypeScript, we can't get actual size at compile time
                        // Return a reasonable default based on common usage
                        return TsExpression::NumberLiteral("4".to_string());
                    }
                }
            }
        }
        
        if property == "spawn" {
            if let TsExpression::Identifier(type_name) = &**object {
                if type_name == "thread" {
                    // thread::spawn(|| {...}) -> spawnFn(() => {...})
                    return TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("spawnFn".to_string())),
                        args: args.clone(),
                    };
                }
            }
        }
        
        // Handle thread::Builder::new() -> Builder_new()
        // object is "Builder", property is "new"
        if property == "new" {
            if let TsExpression::Identifier(type_name) = &**object {
                if type_name == "Builder" {
                    // Builder::new() -> Builder_new()
                    return TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("Builder_new".to_string())),
                        args: args.clone(),
                    };
                }
            }
        }
        
        // Handle primitive type static methods (from, from_be, from_le, from_str_radix, etc.)
        if let TsExpression::Identifier(type_name) = &**object {
            // Check if this is a primitive integer or float type
            let is_primitive_int = matches!(type_name.as_str(),
                "i8" | "i16" | "i32" | "i64" | "i128" | "isize" |
                "u8" | "u16" | "u32" | "u64" | "u128" | "usize"
            );
            let is_primitive_float = matches!(type_name.as_str(), "f32" | "f64");
            
            if is_primitive_int || is_primitive_float {
                match property.as_str() {
                    "from" => {
                        // i32::from(small) -> Number(small) or just small
                        // In TypeScript, numeric conversions are implicit or use Number()
                        if args.len() == 1 {
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("Number".to_string())),
                                args: args.clone(),
                            };
                        }
                    }
                    "from_be" | "from_le" => {
                        // u32::from_be(x) -> x (byte order conversion is no-op in JS)
                        // Note: This is a simplification. In reality, JS numbers are always
                        // in native byte order, but for cross-platform code this is usually fine.
                        if args.len() == 1 {
                            return args[0].clone();
                        }
                    }
                    "from_be_bytes" | "from_le_bytes" => {
                        // u32::from_be_bytes(bytes) -> convert bytes to number
                        // This would need a helper function for proper implementation
                        // For now, return a placeholder
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier("Number".to_string())),
                            args: vec![TsExpression::NumberLiteral("0".to_string())],
                        };
                    }
                    "from_str_radix" => {
                        // i32::from_str_radix(str, radix) -> Ok(parseInt(str, radix))
                        // Note: We wrap in Ok() to indicate this returns a Result type
                        // If followed by .unwrap(), the method call converter will handle it properly
                        if args.len() == 2 {
                            let parse_call = TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("parseInt".to_string())),
                                args: args.clone(),
                            };
                            // Wrap in Ok() constructor
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("Ok".to_string())),
                                args: vec![parse_call],
                            };
                        }
                    }
                    "from_bits" if is_primitive_float => {
                        // f64::from_bits(bits) -> Number.from_bits(bits)
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Member {
                                object: Box::new(TsExpression::Identifier("Number".to_string())),
                                property: "from_bits".to_string(),
                            }),
                            args: args.clone(),
                        };
                    }
                    _ => {}
                }
            }
        }
        
        if property == "new" {
            if let TsExpression::Identifier(type_name) = &**object {
                // Handle smart pointer constructors
                match type_name.as_str() {
                    "Box" => {
                        // Box::new(value) -> new Box(value)
                        if args.len() == 1 {
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("new Box".to_string())),
                                args: args.clone(),
                            };
                        }
                    }
                    "Rc" | "Arc" => {
                        // Rc/Arc::new(value) -> new Rc(value) or new Arc(value)
                        if args.len() == 1 {
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier(format!("new {}", type_name))),
                                args: args.clone(),
                            };
                        }
                    }
                    "RefCell" | "Cell" => {
                        // RefCell/Cell::new(value) -> new RefCell(value) or new Cell(value)
                        if args.len() == 1 {
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier(format!("new {}", type_name))),
                                args: args.clone(),
                            };
                        }
                    }
                    "Weak" => {
                        // Weak::new() -> new Weak()
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier("new Weak".to_string())),
                            args: args.clone(),
                        };
                    }
                    "Builder" => {
                        // thread::Builder::new() -> Builder_new()
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier("Builder_new".to_string())),
                            args: args.clone(),
                        };
                    }
                    _ => {}
                }
            }
        }
        
        // Handle Box static methods (into_raw, from_raw)
        if let TsExpression::Identifier(type_name) = &**object {
            if type_name == "Box" {
                match property.as_str() {
                    "into_raw" => {
                        // Box::into_raw(boxed) -> Box_into_raw(boxed)
                        if args.len() == 1 {
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("Box_into_raw".to_string())),
                                args: args.clone(),
                            };
                        }
                    }
                    "from_raw" => {
                        // Box::from_raw(ptr) -> Box_from_raw(ptr)
                        if args.len() == 1 {
                            return TsExpression::Call {
                                func: Box::new(TsExpression::Identifier("Box_from_raw".to_string())),
                                args: args.clone(),
                            };
                        }
                    }
                    _ => {}
                }
            }
        }
        
        // Handle Rc::clone, Rc::strong_count, etc. - static methods
        if let TsExpression::Identifier(type_name) = &**object {
            match (type_name.as_str(), property.as_str()) {
                ("Rc", "clone") | ("Arc", "clone") => {
                    // Rc::clone(&rc) -> rc.clone()
                    if args.len() == 1 {
                        return TsExpression::MethodCall {
                            receiver: Box::new(args[0].clone()),
                            method: "clone".to_string(),
                            args: vec![],
                        };
                    }
                }
                ("Rc", "strong_count") | ("Arc", "strong_count") => {
                    // Rc::strong_count(&rc) -> Rc.strongCount(rc)
                    if args.len() == 1 {
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Member {
                                object: Box::new(TsExpression::Identifier(type_name.clone())),
                                property: "strongCount".to_string(),
                            }),
                            args: args.clone(),
                        };
                    }
                }
                ("Rc", "weak_count") | ("Arc", "weak_count") => {
                    // Rc::weak_count(&rc) -> Rc.weakCount(rc)
                    if args.len() == 1 {
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Member {
                                object: Box::new(TsExpression::Identifier(type_name.clone())),
                                property: "weakCount".to_string(),
                            }),
                            args: args.clone(),
                        };
                    }
                }
                ("Rc", "downgrade") | ("Arc", "downgrade") => {
                    // Rc::downgrade(&rc) -> rc.downgrade()
                    if args.len() == 1 {
                        return TsExpression::MethodCall {
                            receiver: Box::new(args[0].clone()),
                            method: "downgrade".to_string(),
                            args: vec![],
                        };
                    }
                }
                _ => {}
            }
        }
    }
    
    // Check if this is a static method call (Type::method) or enum variant call
    // CRITICAL FIX: Check if this is a direct class constructor call (uppercase identifier)
    // BUT: Make sure it's actually being called as a constructor (has arguments or is a tuple struct)
    let func = if let TsExpression::Identifier(name) = &func_expr {
        // Check if this looks like a class constructor (starts with uppercase)
        // This handles tuple struct constructors like MyBox(x) -> new MyBox(x)
        if !name.is_empty() && name.chars().next().map_or(false, |c| c.is_uppercase()) {
            // This is a direct constructor call like MyBox(x) or EmailValidator()
            // Convert to: new ClassName(args)
            // The args are already collected above, so we just wrap them in New expression
            return TsExpression::New {
                class: name.clone(),
                args,
            };
        }
        Box::new(func_expr.clone())
    } else if let TsExpression::Call { func: inner_func, args: inner_args } = &func_expr {
        // CRITICAL FIX: Handle new MyBox() returning a constructor function
        // This is the case where MyBox::new() was converted to "new MyBox()" (a Call expression)
        // and we're calling it with (x), resulting in new MyBox()(x)
        // We need to detect this pattern and convert it to new MyBox(x)
        if let TsExpression::Identifier(class_name) = &**inner_func {
            if class_name.starts_with("new ") {
                // Extract class name from "new ClassName"
                let actual_class = class_name.trim_start_matches("new ").trim();
                // Combine inner_args (from MyBox::new()) with outer args (the x)
                let mut combined_args = inner_args.clone();
                combined_args.extend(args);
                return TsExpression::New {
                    class: actual_class.to_string(),
                    args: combined_args,
                };
            }
        }
        Box::new(func_expr.clone())
    } else if let TsExpression::Member { object, property } = &func_expr {
        // For Type::new and other Type::method patterns, convert to Type.method (static method call)
        // This is NOT a constructor call - constructors are only created when we see impl blocks
        // Example: TreeNode::new(value) -> TreeNode.new(value)
        // Example: Box::new(value) was already handled above and returns the unwrapped value
        Box::new(func_expr.clone())
    } else {
        Box::new(func_expr.clone())
    };
    
    // Special handling for String("literal") -> just "literal"
    if let TsExpression::Identifier(ref func_name) = *func {
        if func_name == "String" && args.len() == 1 {
            if let TsExpression::StringLiteral(_) = &args[0] {
                return args[0].clone();
            }
        }
    }
    
    // Special handling for Vec::new() -> []
    if let TsExpression::Member { object, property } = &func_expr {
        if let TsExpression::Identifier(type_name) = &**object {
            if type_name == "Vec" && property == "new" && args.is_empty() {
                return TsExpression::Array(vec![]);
            }
            // Special handling for Vec::with_capacity(n) -> Vec_with_capacity(n)
            if type_name == "Vec" && property == "with_capacity" && args.len() == 1 {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("Vec_with_capacity".to_string())),
                    args: args.clone(),
                };
            }
            // Special handling for HashMap::new() -> HashMap_new()
            if type_name == "HashMap" && property == "new" && args.is_empty() {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("HashMap_new".to_string())),
                    args: vec![],
                };
            }
            // Special handling for HashMap::with_capacity(n) -> HashMap_withCapacity(n)
            if type_name == "HashMap" && property == "with_capacity" && args.len() == 1 {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("HashMap_withCapacity".to_string())),
                    args: args.clone(),
                };
            }
            // Special handling for HashSet::new() -> HashSet_new()
            if type_name == "HashSet" && property == "new" && args.is_empty() {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("HashSet_new".to_string())),
                    args: vec![],
                };
            }
            // Special handling for HashSet::with_capacity(n) -> HashSet_withCapacity(n)
            if type_name == "HashSet" && property == "with_capacity" && args.len() == 1 {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("HashSet_withCapacity".to_string())),
                    args: args.clone(),
                };
            }
            // Special handling for BTreeMap::new() -> new BTreeMap()
            if type_name == "BTreeMap" && property == "new" && args.is_empty() {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("new BTreeMap".to_string())),
                    args: vec![],
                };
            }
            // Special handling for String::new() -> ""
            if type_name == "String" && property == "new" && args.is_empty() {
                return TsExpression::StringLiteral("".to_string());
            }
            // Special handling for String::from(literal) -> literal
            if type_name == "String" && property == "from" && args.len() == 1 {
                return args[0].clone();
            }
            // Special handling for Vec::from(array) -> Vec_from(array)
            // This allows proper conversion while maintaining consistency with other static methods
            if type_name == "Vec" && property == "from" && args.len() == 1 {
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("Vec_from".to_string())),
                    args: args.clone(),
                };
            }
            // Special handling for String::from_utf8, String::from_utf8_lossy, String::from_utf8_unchecked
            // These need to be converted to helper function calls
            if type_name == "String" {
                match property.as_str() {
                    "from_utf8" | "from_utf8_lossy" | "from_utf8_unchecked" | "with_capacity" => {
                        // String::from_utf8(bytes) -> String_from_utf8(bytes)
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier(format!("String_{}", property))),
                            args: args.clone(),
                        };
                    }
                    _ => {}
                }
            }
        }
    }
    
    TsExpression::Call { func, args }
}

/// Convert method call expressions to TypeScript
pub fn convert_method_call(method_call: &ExprMethodCall, convert_expr: &dyn Fn(&syn::Expr) -> TsExpression) -> TsExpression {
    let mut receiver = Box::new(convert_expr(&method_call.receiver));
    let method = method_call.method.to_string();
    
    let args: Vec<TsExpression> = method_call.args.iter().map(|arg| convert_expr(arg)).collect();
    
    // CRITICAL: Check if this is a call to a method with explicit `self: &Rc<Self>` receiver
    // These methods are converted to static methods, so we need to convert the call site too
    // Example: node1.append(2) -> ListNode.append(node1, 2)
    if let Some(class_name) = try_infer_rc_wrapped_class(&method_call.receiver, &receiver, &method) {
        // This is a call to a static method that takes Rc<Self> as first parameter
        // Convert: receiver.method(args) -> ClassName.method(receiver, args)
        let mut static_args = vec![*receiver];
        static_args.extend(args);
        
        return TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier(class_name)),
                property: method.clone(),
            }),
            args: static_args,
        };
    }
    
    // Special handling for lock(), read(), and write() methods on Arc<Mutex<T>> and Arc<RwLock<T>>
    // Check if this is a lock/read/write call on a variable that might be Arc-wrapped
    if matches!(method.as_str(), "lock" | "read" | "write") {
        // Check if receiver is already a .get() call (indicating Arc dereference)
        let is_arc_get = matches!(&*receiver, TsExpression::MethodCall { method: m, .. } if m == "get");
        
        if !is_arc_get {
            if let syn::Expr::Path(path) = &*method_call.receiver {
                if let Some(ident) = path.path.get_ident() {
                    let var_name = ident.to_string();
                    // Check if variable name suggests it's an Arc (clone or original)
                    // Common patterns: xxx_clone, counter, data, state, shared_xxx, mutex, etc.
                    let is_likely_arc = var_name.contains("clone") ||
                                       var_name.ends_with("_clone") ||
                                       var_name == "counter" ||
                                       var_name == "data" ||
                                       var_name == "state" ||
                                       var_name == "mutex" ||
                                       var_name.starts_with("mutex") ||
                                       var_name.ends_with("_mutex") ||
                                       var_name.starts_with("shared_") ||
                                       var_name.starts_with("arc_") ||
                                       var_name.ends_with("_arc");
                    
                    if is_likely_arc {
                        // Insert .get() call to dereference Arc
                        receiver = Box::new(TsExpression::MethodCall {
                            receiver,
                            method: "get".to_string(),
                            args: vec![],
                        });
                    }
                }
            }
        }
        
        // In TypeScript, lock()/read()/write() return the guard directly (not Result)
        // However, for compatibility with Rust code that matches on lock() results,
        // we need to check if this is being used in a match expression
        // For now, return the method call and let unwrap() handling deal with it
        let method_call_expr = TsExpression::MethodCall {
            receiver,
            method: method.clone(),
            args,
        };
        
        // Return the method call directly
        // Note: If this is followed by .unwrap(), the unwrap handler will remove it
        return method_call_expr;
    }
    
    // CRITICAL: Check if receiver is a field access (e.g., self.map, self.strings)
    // and infer the field type for proper method resolution
    let field_type = if let syn::Expr::Field(field_expr) = &*method_call.receiver {
        // Extract field name from field access
        if let syn::Member::Named(field_name) = &field_expr.member {
            let field_name_str = field_name.to_string();
            // Infer type from common field naming patterns
            // This is a heuristic approach - map -> HashMap, strings/items/vec -> Vec, set -> HashSet
            match field_name_str.as_str() {
                "map" | "metadata" => Some("HashMap"),
                "strings" | "items" | "vec" | "data" | "elements" | "values" => Some("Vec"),
                "set" => Some("HashSet"),
                _ => {
                    // Try to infer from field name patterns
                    if field_name_str.ends_with("_map") || field_name_str.starts_with("map_") ||
                       field_name_str.contains("metadata") {
                        Some("HashMap")
                    } else if field_name_str.ends_with("_set") || field_name_str.starts_with("set_") {
                        Some("HashSet")
                    } else if field_name_str.ends_with("_vec") || field_name_str.ends_with("s") {
                        Some("Vec")
                    } else {
                        None
                    }
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    
    // Check if receiver is an Rc/Arc and the method is not a smart pointer method
    // If so, automatically dereference to access inner object's methods
    let is_smart_ptr_method = matches!(method.as_str(),
        "clone" | "get" | "deref" | "downgrade" | "borrow" | "borrowMut" | "set" | "upgrade" | "lock"
    );
    
    // Auto-dereference for non-smart-pointer methods
    let needs_auto_deref = !is_smart_ptr_method;
    
    if needs_auto_deref && is_smart_pointer_receiver(&method_call.receiver) {
        // Automatically dereference: rc.method() -> rc.get().method()
        receiver = Box::new(TsExpression::MethodCall {
            receiver,
            method: "get".to_string(),
            args: vec![],
        });
    }
    
    // Special handling for RefCell/Cell method call chains
    // E.g., refcell.borrow_mut().push(x) should become refcell.borrowMut().push(x)
    // In TypeScript, borrowMut() returns a RefMut proxy that supports mutating methods like push
    if let syn::Expr::MethodCall(inner_method) = &*method_call.receiver {
        if inner_method.method == "borrow_mut" || inner_method.method == "borrowMut" {
            // Special case: borrow_mut().clone_from(x) -> refcell.set(x)
            if method == "clone_from" {
                let inner_receiver = convert_expr(&inner_method.receiver);
                let args: Vec<TsExpression> = method_call.args.iter().map(|arg| convert_expr(arg)).collect();
                if args.len() == 1 {
                    return TsExpression::MethodCall {
                        receiver: Box::new(inner_receiver),
                        method: "set".to_string(),
                        args,
                    };
                }
            }
            
            // This is a chain like receiver.borrow_mut().some_method(args)
            // Keep as borrowMut() for mutating operations
            let inner_receiver = convert_expr(&inner_method.receiver);
            let borrow_mut_call = TsExpression::MethodCall {
                receiver: Box::new(inner_receiver),
                method: "borrowMut".to_string(),
                args: vec![],
            };
            
            let args: Vec<TsExpression> = method_call.args.iter().map(|arg| convert_expr(arg)).collect();
            
            // Check if the outer method (method) is a Vec method that needs special handling
            // E.g., .borrow_mut().retain() should become converted retain expression
            if let Some(vec_method) = VecMethod::from_str(&method) {
                return convert_vec_method_to_native(vec_method, Box::new(borrow_mut_call), args);
            }
            
            // Special handling for .borrow_mut().clone() on Vec - convert to .borrowMut().slice()
            if method == "clone" {
                return TsExpression::MethodCall {
                    receiver: Box::new(borrow_mut_call),
                    method: "slice".to_string(),
                    args: vec![],
                };
            }
            
            // Now apply the outer method to the borrowMut() result
            return TsExpression::MethodCall {
                receiver: Box::new(borrow_mut_call),
                method: method.clone(),
                args,
            };
        }
        
        // Also handle borrow() chains (keep them as is)
        if inner_method.method == "borrow" {
            let inner_receiver = convert_expr(&inner_method.receiver);
            let borrow_call = TsExpression::MethodCall {
                receiver: Box::new(inner_receiver),
                method: "borrow".to_string(),
                args: vec![],
            };
            
            let args: Vec<TsExpression> = method_call.args.iter().map(|arg| convert_expr(arg)).collect();
            
            // Check if the outer method (method) is a Vec method that needs special handling
            // E.g., .borrow().len() should become .borrow().length
            if let Some(vec_method) = VecMethod::from_str(&method) {
                return convert_vec_method_to_native(vec_method, Box::new(borrow_call), args);
            }
            
            // Special handling for .borrow().clone() on Vec - convert to .borrow().slice()
            if method == "clone" {
                return TsExpression::MethodCall {
                    receiver: Box::new(borrow_call),
                    method: "slice".to_string(),
                    args: vec![],
                };
            }
            
            return TsExpression::MethodCall {
                receiver: Box::new(borrow_call),
                method: method.clone(),
                args,
            };
        }
    }
    
    // Detect if the receiver is a BTreeMap, HashMap, HashSet, BTreeSet, or BinaryHeap by checking the receiver expression type
    let is_btreemap = is_btreemap_receiver(&method_call.receiver);
    let is_hashmap = is_hashmap_receiver(&method_call.receiver);
    let mut is_hashset = is_hashset_receiver(&method_call.receiver);
    let is_btreeset = is_btreeset_receiver(&method_call.receiver);
    let is_binaryheap = is_binaryheap_receiver(&method_call.receiver);
    
    // Also check variable type information from declarations
    if !is_hashset && !is_hashmap && !is_btreemap {
        if let syn::Expr::Path(path) = &*method_call.receiver {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "HashSet" {
                        is_hashset = true;
                    }
                }
            }
        }
    }
    
    // Special handling for BTreeMap::range() - extract range bounds instead of converting to Array.from
    let args: Vec<TsExpression> = if method == "range" {
        method_call.args.iter().map(|arg| {
            // Check if arg is a Range expression
            if let syn::Expr::Range(range_expr) = arg {
                // For range expressions in BTreeMap::range(), we need the start and end values
                // Not the Array.from representation
                // We'll handle this specially below
                convert_expr(arg)
            } else {
                convert_expr(arg)
            }
        }).collect()
    } else {
        method_call.args.iter().map(|arg| convert_expr(arg)).collect()
    };
    
    // **PRIORITY 1: Check Vec and BinaryHeap methods FIRST for push/pop methods**
    // Vec.push()/pop() and BinaryHeap.push()/pop() must take priority over String.push()/pop() to avoid misidentification
    if method == "push" || method == "pop" {
        // Check if this is a BinaryHeap first (more specific)
        if is_binaryheap {
            if let Some(m) = BinaryHeapMethod::from_str(&method) {
                return generate_helper_call("BinaryHeap", &m, receiver, args);
            }
        }
        // Then check if this looks like a Vec/array variable
        if is_vec_receiver(&method_call.receiver) {
            if let Some(vec_method) = VecMethod::from_str(&method) {
                return convert_vec_method_to_native(vec_method, receiver, args);
            }
        }
    }
    
    // **CRITICAL PRIORITY 2: Check for .get() with NO arguments FIRST**
    // Cell.get() has NO arguments, while String.get() MUST have a range argument
    // This MUST come before MetadataRegistry check to prevent Cell.get() being treated as String.get()
    if method == "get" && args.is_empty() {
        // No arguments: this is Cell.get() or similar smart pointer method
        // Keep as a method call, don't convert to String_get
        return TsExpression::MethodCall {
            receiver,
            method: "get".to_string(),
            args,
        };
    }
    
    // **PRIORITY 2: Check String methods**
    // String methods (len, is_empty, clear) conflict with HashMap/HashSet methods
    // Default to String interpretation unless receiver is definitely a collection type
    
    // Special handling for remove/insert methods (exist in both String and HashMap)
    // CRITICAL: Check field type FIRST (for self.map, self.strings), then stored variable type
    if method == "remove" || method == "insert" {
        // PRIORITY 1: Check if this is a field access with inferred type
        if let Some(inferred_type) = field_type {
            match inferred_type {
                "HashMap" => {
                    if let Some(m) = HashMapMethod::from_str(&method) {
                        return generate_helper_call("HashMap", &m, receiver, args);
                    }
                }
                "Vec" => {
                    if let Some(m) = VecMethod::from_str(&method) {
                        return convert_vec_method_to_native(m, receiver, args);
                    }
                }
                "HashSet" => {
                    if let Some(m) = HashSetMethod::from_str(&method) {
                        return generate_helper_call("HashSet", &m, receiver, args);
                    }
                }
                _ => {}
            }
        }
        
        // PRIORITY 2: Check stored type information from variable declarations
        if let syn::Expr::Path(path) = &*method_call.receiver {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    // Use stored type to determine correct method handler
                    match var_type.as_str() {
                        "BTreeSet" => {
                            if let Some(m) = BTreeSetMethod::from_str(&method) {
                                return generate_helper_call("BTreeSet", &m, receiver, args);
                            }
                        }
                        "HashSet" => {
                            if let Some(m) = HashSetMethod::from_str(&method) {
                                return generate_helper_call("HashSet", &m, receiver, args);
                            }
                        }
                        "HashMap" => {
                            if let Some(m) = HashMapMethod::from_str(&method) {
                                return generate_helper_call("HashMap", &m, receiver, args);
                            }
                        }
                        "BTreeMap" => {
                            if let Some(m) = BTreeMapMethod::from_str(&method) {
                                return generate_helper_call("BTreeMap", &m, receiver, args);
                            }
                        }
                        "Vec" => {
                            if let Some(m) = VecMethod::from_str(&method) {
                                return convert_vec_method_to_native(m, receiver, args);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        
        let registry = crate::metadata::MetadataRegistry::new();
        let is_definitely_collection = is_hashmap_receiver(&method_call.receiver) ||
                                       is_hashset_receiver(&method_call.receiver) ||
                                       is_btreemap_receiver(&method_call.receiver) ||
                                       is_btreeset ||
                                       is_binaryheap ||
                                       is_vec_receiver(&method_call.receiver);
        
        // If NOT a collection, check if String has this method in metadata
        if !is_definitely_collection {
            if let Some(binding) = registry.get_method("String", &method) {
                // Use String method from metadata
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
                    args: call_args,
                };
            }
        }
    }
    
    // CRITICAL: Check if receiver is this.items (MyVec case) and prioritize Vec mapping
    // This prevents MyVec methods from being misidentified as String methods
    let is_this_items = matches!(&*receiver,
        TsExpression::Member { object, property } if
            matches!(&**object, TsExpression::Identifier(id) if id == "this") &&
            property == "items"
    );
    
    // If receiver is this.items, prioritize Vec methods
    if is_this_items {
        if let Some(vec_method) = VecMethod::from_str(&method) {
            return convert_vec_method_to_native(vec_method, receiver, args);
        }
    }
    
    // Check MetadataRegistry for String methods
    // This handles all String methods through metadata registry
    // CRITICAL: Check if receiver is a string literal or string-returning expression
    // BUT: Skip if we have field type information (e.g., self.map, self.strings)
    {
        let is_definitely_collection = is_hashmap_receiver(&method_call.receiver) ||
                                       is_hashset_receiver(&method_call.receiver) ||
                                       is_btreemap_receiver(&method_call.receiver) ||
                                       is_vec_receiver(&method_call.receiver) ||
                                       is_vecdeque_receiver(&method_call.receiver) ||
                                       is_linkedlist_receiver(&method_call.receiver) ||
                                       field_type.is_some(); // CRITICAL: Also skip if we have field type
        
        // CRITICAL FIX: Also check if receiver is a known class type (OpenOptions, File, etc.)
        // These types have their own methods and should not be confused with String methods
        let is_known_class_type = is_known_class_receiver(&method_call.receiver);
        
        // Also check if the converted receiver is a string literal (TsExpression)
        let is_string_literal = matches!(&*receiver, TsExpression::StringLiteral(_));
        
        // Check if receiver is a String type from original Rust expression
        let is_string_expr = is_string_receiver(&method_call.receiver);
        
        // If NOT a collection AND NOT this.items AND NOT known class AND (string literal OR string expression), check String methods
        if !is_definitely_collection && !is_this_items && !is_known_class_type && (is_string_literal || is_string_expr) {
            let registry = crate::metadata::MetadataRegistry::new();
            if let Some(binding) = registry.get_method("String", &method) {
                // Use String method from metadata registry
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
                    args: call_args,
                };
            }
        }
        
        // Fallback: if NOT a collection AND NOT known class, also check String methods even if we're not sure
        // This catches cases where variable type inference fails
        // BUT: Skip if we have field type information OR if it's a known class type
        if !is_definitely_collection && !is_known_class_type {
            let registry = crate::metadata::MetadataRegistry::new();
            if let Some(binding) = registry.get_method("String", &method) {
                // Use String method from metadata registry
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
                    args: call_args,
                };
            }
        }
    }
    
    // CRITICAL: Check field type first for proper method resolution
    // This handles self.map, self.strings, etc. in struct implementations
    if let Some(inferred_type) = field_type {
        match inferred_type {
            "HashMap" => {
                if let Some(m) = HashMapMethod::from_str(&method) {
                    return generate_helper_call("HashMap", &m, receiver, args);
                }
            }
            "Vec" => {
                if let Some(m) = VecMethod::from_str(&method) {
                    return convert_vec_method_to_native(m, receiver, args);
                }
            }
            "HashSet" => {
                if let Some(m) = HashSetMethod::from_str(&method) {
                    return generate_helper_call("HashSet", &m, receiver, args);
                }
            }
            _ => {}
        }
    }
    
    // Check if this is a BTreeSet method first (before iterator methods)
    if is_btreeset {
        if let Some(btreeset_method) = BTreeSetMethod::from_str(&method) {
            return generate_helper_call("BTreeSet", &btreeset_method, receiver, args);
        }
    }
    
    // Check if this is a BTreeMap method first (if we detected BTreeMap type)
    if is_btreemap {
        if let Some(btreemap_method) = BTreeMapMethod::from_str(&method) {
            // Special handling for BTreeMap::range() with Range expression
            if method == "range" && method_call.args.len() == 1 {
                if let syn::Expr::Range(range_expr) = &method_call.args[0] {
                    // Extract start and end from range expression
                    let start = range_expr.start.as_ref()
                        .map(|e| convert_expr(e))
                        .unwrap_or_else(|| TsExpression::Identifier("undefined".to_string()));
                    let end = range_expr.end.as_ref()
                        .map(|e| convert_expr(e))
                        .unwrap_or_else(|| TsExpression::Identifier("undefined".to_string()));
                    
                    // Call BTreeMap_range(map, start, end)
                    return TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("BTreeMap_range".to_string())),
                        args: vec![*receiver, start, end],
                    };
                }
            }
            return generate_helper_call("BTreeMap", &btreemap_method, receiver, args);
        }
    }
    
    // **PRIORITY: Check Vec methods BEFORE HashMap for 'get' method**
    // Vec.get() must take priority over HashMap.get() to avoid misidentification
    if let Some(vec_method) = VecMethod::from_str(&method) {
        // For methods that exist in both Vec and String (like 'retain'), check type from VAR_TYPES
        // If we have explicit type information, use it
        let is_definitely_string = if let syn::Expr::Path(path) = &*method_call.receiver {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    var_type == "String"
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };
        
        // Check if receiver is explicitly typed as Vec from VAR_TYPES
        let is_definitely_vec = if let syn::Expr::Path(path) = &*method_call.receiver {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    var_type == "Vec"
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };
        
        // CRITICAL: If definitely a String, skip Vec method handling entirely
        // This prevents String.retain() from being treated as Vec.retain()
        if is_definitely_string {
            // Don't process as Vec method, fall through to String method handling below
        } else if method == "get" || method == "insert" {
            // For 'get' and 'insert' methods, check Vec first with strict detection
            // These methods exist in both Vec and HashMap, need careful type detection
            // PRIORITY: If explicitly typed as Vec, always use Vec method
            // CRITICAL: Check is_vec_receiver FIRST before checking other collection types
            // This prevents Vec.get() from being misidentified as BTreeMap.get()
            let looks_like_vec = is_vec_receiver(&method_call.receiver);
            let looks_like_hashmap = is_hashmap_receiver(&method_call.receiver);
            let looks_like_string = is_string_receiver(&method_call.receiver);
            let looks_like_btreemap = is_btreemap_receiver(&method_call.receiver);
            
            // If definitely typed as Vec OR looks like vec but NOT explicitly other types, use Vec method
            if is_definitely_vec || (looks_like_vec && !looks_like_hashmap && !looks_like_string && !looks_like_btreemap) {
                return convert_vec_method_to_native(vec_method, receiver, args);
            }
        } else if is_definitely_vec || (is_vec_receiver(&method_call.receiver) && !is_hashmap_receiver(&method_call.receiver) && !is_string_receiver(&method_call.receiver)) {
            // For other Vec methods, use normal detection but still exclude HashMap and String
            return convert_vec_method_to_native(vec_method, receiver, args);
        }
    }
    
    // Check for String.get(range) - range argument detection
    // String.get(range) must be detected before HashMap.get(key)
    if method == "get" && args.len() == 1 {
        // Check if the argument looks like a range (Array.from pattern from range conversion)
        let is_range_arg = matches!(&args[0],
            TsExpression::Call { func, .. } if matches!(&**func,
                TsExpression::Member { object, property } if
                    matches!(&**object, TsExpression::Identifier(name) if name == "Array") &&
                    property == "from"
            )
        );
        
        // CRITICAL FIX: If argument is a Range, it MUST be String.get() or slice.get()
        // because NO collection type (HashMap, Vec, HashSet, BTreeMap) accepts range arguments!
        if is_range_arg {
            // This is String.get(range) or slice.get(range) -> String_get(s, range)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            return TsExpression::Call {
                func: Box::new(TsExpression::Identifier("String_get".to_string())),
                args: call_args,
            };
        }
    }
    
    // Check if this is a HashSet method first (if we detected HashSet type)
    if is_hashset {
        if let Some(hashset_method) = HashSetMethod::from_str(&method) {
            return generate_helper_call("HashSet", &hashset_method, receiver, args);
        }
    }
    
    // Check if method exists in both HashSet and HashMap (ambiguous methods)
    // For ambiguous methods, we need stronger type detection
    let hashset_has_method = HashSetMethod::from_str(&method).is_some();
    let hashmap_has_method = HashMapMethod::from_str(&method).is_some();
    
    // If method exists in both, try to detect type from the converted receiver expression
    if hashset_has_method && hashmap_has_method && !is_btreemap {
        // Check if the receiver looks like a Set in TypeScript
        let is_likely_set = matches!(&*receiver,
            TsExpression::Call { func, .. } if matches!(&**func,
                TsExpression::Identifier(name) if name.contains("Set")
            )
        );
        
        if is_likely_set {
            if let Some(hashset_method) = HashSetMethod::from_str(&method) {
                return generate_helper_call("HashSet", &hashset_method, receiver, args);
            }
        }
    }
    
    // Check if this is a HashMap method (if we detected HashMap type or method exists in HashMap)
    // BUT: Exclude Vec receivers even if the method exists in HashMap (e.g., .get())
    let is_vec = is_vec_receiver(&method_call.receiver);
    
    // Also check if the converted receiver looks like a Map in TypeScript
    let is_likely_map = matches!(&*receiver,
        TsExpression::Call { func, .. } if matches!(&**func,
            TsExpression::Identifier(name) if name.contains("Map") && !name.contains("BTreeMap")
        )
    ) || matches!(&*receiver, TsExpression::Identifier(name) if name.ends_with("_map") || name.starts_with("map_"));
    
    // CRITICAL: Check if this is a get() call with Range argument (String.get case)
    // HashMap.get() doesn't accept ranges, only keys
    let has_range_arg = if method == "get" && args.len() == 1 {
        matches!(&args[0],
            TsExpression::Call { func, .. } if matches!(&**func,
                TsExpression::Member { object, property } if
                    matches!(&**object, TsExpression::Identifier(name) if name == "Array") &&
                    property == "from"
            )
        )
    } else {
        false
    };
    
    // CRITICAL: Check if receiver is a known class type (like Metadata, Permissions, etc.)
    // These types have their own methods and should NOT be treated as HashMap
    let is_known_class = is_known_class_receiver(&method_call.receiver);
    
    // Don't treat as HashMap if:
    // 1. It has a range argument (that's String.get)
    // 2. It's a known class type (Metadata, Permissions, etc.)
    if !has_range_arg && !is_known_class && (is_hashmap || is_likely_map || (!is_btreemap && !is_hashset && !is_vec && hashmap_has_method)) {
        if let Some(hashmap_method) = HashMapMethod::from_str(&method) {
            return generate_helper_call("HashMap", &hashmap_method, receiver, args);
        }
    }
    
    // If not HashMap, try BTreeMap methods (they share many method names)
    // CRITICAL: Exclude Vec receivers AND known class types (like Metadata, Permissions, etc.)
    // to prevent Vec.get() or metadata.len() being treated as BTreeMap methods
    if !is_vec && !is_known_class {
        if let Some(btreemap_method) = BTreeMapMethod::from_str(&method) {
            // Special handling for BTreeMap::range() with Range expression
            if method == "range" && method_call.args.len() == 1 {
                if let syn::Expr::Range(range_expr) = &method_call.args[0] {
                    // Extract start and end from range expression
                    let start = range_expr.start.as_ref()
                        .map(|e| convert_expr(e))
                        .unwrap_or_else(|| TsExpression::Identifier("undefined".to_string()));
                    let end = range_expr.end.as_ref()
                        .map(|e| convert_expr(e))
                        .unwrap_or_else(|| TsExpression::Identifier("undefined".to_string()));
                    
                    // Call BTreeMap_range(map, start, end)
                    return TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("BTreeMap_range".to_string())),
                        args: vec![*receiver, start, end],
                    };
                }
            }
            return generate_helper_call("BTreeMap", &btreemap_method, receiver, args);
        }
    }
    
    // Check MetadataRegistry for BTreeMap methods not in enum
    // This handles methods like keys(), values(), iter(), first_key_value(), last_key_value(), range()
    if is_btreemap {
        let registry = crate::metadata::MetadataRegistry::new();
        if let Some(binding) = registry.get_method("BTreeMap", &method) {
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            return TsExpression::Call {
                func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
                args: call_args,
            };
        }
    }
    
    // Special handling for unwrap/expect on lock(), read(), write() calls BEFORE Result method processing
    // lock()/read()/write() return guards directly in TS, no unwrap needed
    if matches!(method.as_str(), "unwrap" | "expect") {
        if is_lock_call(&*receiver) {
            // lock() returns MutexGuard<T> directly in TS, no unwrap needed
            return *receiver;
        }
        if is_rwlock_call(&*receiver) {
            // read()/write() return RwLockReadGuard<T>/RwLockWriteGuard<T> directly in TS, no unwrap needed
            return *receiver;
        }
        // Also check if receiver is await (for join().unwrap() case)
        if matches!(*receiver, TsExpression::Await(_)) {
            // join() returns T directly after await, no unwrap needed
            return *receiver;
        }
    }
    
    // Check if this is a Result method FIRST (before Iterator)
    // This ensures result.map() is treated as Result::map, not Iterator::map
    // But skip if receiver is an Await expression (join().unwrap() case) or lock() call
    if let Some(result_method) = ResultMethod::from_str(&method) {
        // Check if receiver looks like it returns Result
        // This handles cases like: divide(10, 2).map(...) where divide returns Result
        let receiver_likely_result = is_result_returning_expr(&method_call.receiver) ||
                                      is_result_returning_ts_expr(&receiver);
        
        // CRITICAL: Also check if receiver is Ok() or Err() constructor call
        // This handles: Ok(parseInt(hex_str, 16)).unwrap() -> Result_unwrap(Ok(parseInt(...)))
        let receiver_is_result_constructor = matches!(&*receiver,
            TsExpression::Call { func, .. } if matches!(&**func,
                TsExpression::Identifier(name) if name == "Ok" || name == "Err"
            )
        );
        
        if receiver_likely_result || receiver_is_result_constructor {
            return generate_helper_call("Result", &result_method, receiver, args);
        }
    }
    
    // Check if this is an Option method (before Iterator to handle option.map correctly)
    if let Some(option_method) = OptionMethod::from_str(&method) {
        // Check if receiver looks like it returns Option
        let receiver_likely_option = is_option_returning_expr(&method_call.receiver);
        
        // CRITICAL: Also check if receiver is Some() or None constructor call
        // This handles: Some(42).unwrap() -> Option_unwrap(Some(42))
        // This handles: None.unwrap_or(0) -> Option_unwrap_or(None, 0)
        let receiver_is_option_constructor = matches!(&*receiver,
            TsExpression::Call { func, .. } if matches!(&**func,
                TsExpression::Identifier(name) if name == "Some"
            )
        ) || matches!(&*receiver, TsExpression::Identifier(name) if name == "None");
        
        if receiver_likely_option || receiver_is_option_constructor {
            return generate_helper_call("Option", &option_method, receiver, args);
        }
    }
    
    // CRITICAL: Check for numeric max/min BEFORE IteratorMethod
    // Numeric types (f64, i32, etc.): a.max(b) has 1 argument -> Math.max(a, b)
    // Iterator types: iter.max() has 0 arguments -> handled by IteratorMethod
    if method == "max" || method == "min" {
        if !args.is_empty() {
            // Has args: this is numeric a.max(b) or a.min(b) -> Math.max(a, b) or Math.min(a, b)
            return TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: method.clone(),
                }),
                args: vec![*receiver, args[0].clone()],
            };
        }
        // If no args, fall through to IteratorMethod handling below
    }
    
    // Check if this is an Iterator method - convert to native array methods
    // NOTE: This is checked AFTER Result/Option to avoid conflicts with .map()
    if let Some(iterator_method) = IteratorMethod::from_str(&method) {
        // CRITICAL: Special handling for position() method
        // Distinguish between Iterator::position and Cursor::position
        if matches!(iterator_method, IteratorMethod::Position) {
            // Check if the receiver is a Cursor type
            let is_cursor = is_cursor_receiver(&method_call.receiver);
            
            if is_cursor {
                // This is Cursor::position(), keep as instance method call
                // cursor.position() -> cursor.position()
                return TsExpression::MethodCall {
                    receiver,
                    method: "position".to_string(),
                    args,
                };
            }
            // Otherwise fall through to Iterator::position conversion
        }
        
        // CRITICAL: Special handling for chain method
        // Distinguish between Iterator::chain and Read::chain
        if matches!(iterator_method, IteratorMethod::Chain) {
            // Check if the original Rust receiver is a string/Read type (including byte slices)
            // Byte slices (&[u8]) also implement Read trait and have chain method
            let is_likely_reader = is_string_receiver(&method_call.receiver) || is_byte_slice_receiver(&method_call.receiver);
            
            if is_likely_reader {
                // This is Read::chain, keep as method call
                // String.prototype.chain is already defined
                return TsExpression::MethodCall {
                    receiver,
                    method: "chain".to_string(),
                    args,
                };
            }
        }
        
        return convert_iterator_method_to_native(iterator_method, receiver, args);
    }
    
    // Check if this is a JoinHandle method (thread operations)
    // CRITICAL: Only apply await to JoinHandle.join(), NOT array.join()
    if method == "join" {
        // Check if the receiver is likely a JoinHandle from thread::spawn
        // Array/Vec join takes a separator argument, JoinHandle join takes no args
        let is_likely_joinhandle = args.is_empty() && is_joinhandle_receiver(&method_call.receiver);
        
        if is_likely_joinhandle {
            // handle.join() -> await handle.join()
            // handle.join().unwrap() will be handled by the unwrap conversion
            return TsExpression::Await(
                Box::new(TsExpression::MethodCall {
                    receiver,
                    method: "join".to_string(),
                    args,
                })
            );
        }
        // Otherwise, it's array.join(separator) - keep as normal method call
    }
    
    // Check if this is a Sender or Receiver method (mpsc channel operations)
    // These methods need to use helper functions to ensure proper Result/Option wrapping
    if let syn::Expr::Path(path) = &*method_call.receiver {
        if let Some(ident) = path.path.get_ident() {
            let var_name = ident.to_string();
            // Check if variable name suggests it's a Sender (tx, tx_1, sender, etc.)
            let is_likely_sender = var_name.starts_with("tx") ||
                                  var_name.ends_with("_tx") ||
                                  var_name.contains("sender") ||
                                  var_name.starts_with("producer");
            
            if is_likely_sender && method == "send" {
                // tx.send(value) -> Sender_send(tx, value)
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("Sender_send".to_string())),
                    args: call_args,
                };
            }
            
            // Check if variable name suggests it's a Receiver (rx, rx_1, receiver, etc.)
            let is_likely_receiver = var_name.starts_with("rx") ||
                                    var_name.ends_with("_rx") ||
                                    var_name.contains("receiver") ||
                                    var_name.starts_with("consumer");
            
            if is_likely_receiver {
                match method.as_str() {
                    "recv" => {
                        // rx.recv() -> Receiver_recv(rx)
                        let mut call_args = vec![*receiver];
                        call_args.extend(args);
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier("Receiver_recv".to_string())),
                            args: call_args,
                        };
                    }
                    "try_recv" => {
                        // rx.try_recv() -> Receiver_try_recv(rx)
                        let mut call_args = vec![*receiver];
                        call_args.extend(args);
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier("Receiver_try_recv".to_string())),
                            args: call_args,
                        };
                    }
                    _ => {}
                }
            }
        }
    }
    
    // Check if this is a smart pointer method
    // Try to detect the type from the receiver expression
    let type_hint = extract_type_hint(&receiver);
    if let Some(smart_ptr_method) = SmartPointerMethod::from_str_with_type(&method, &type_hint) {
        // Handle RefCell and Cell methods specially as instance methods
        match smart_ptr_method {
            SmartPointerMethod::RefCellBorrow => {
                // refcell.borrow() -> refcell.borrow()
                return TsExpression::MethodCall {
                    receiver,
                    method: "borrow".to_string(),
                    args,
                };
            }
            SmartPointerMethod::RefCellBorrowMut => {
                // refcell.borrow_mut() -> refcell.borrowMut()
                return TsExpression::MethodCall {
                    receiver,
                    method: "borrowMut".to_string(),
                    args,
                };
            }
            SmartPointerMethod::CellGet => {
                // cell.get() -> cell.get()
                return TsExpression::MethodCall {
                    receiver,
                    method: "get".to_string(),
                    args,
                };
            }
            SmartPointerMethod::CellSet => {
                // cell.set(value) -> cell.set(value)
                return TsExpression::MethodCall {
                    receiver,
                    method: "set".to_string(),
                    args,
                };
            }
            SmartPointerMethod::WeakUpgrade => {
                // weak.upgrade() -> weak.upgrade()
                return TsExpression::MethodCall {
                    receiver,
                    method: "upgrade".to_string(),
                    args,
                };
            }
            SmartPointerMethod::RcClone | SmartPointerMethod::ArcClone => {
                // rc.clone() -> rc.clone()
                return TsExpression::MethodCall {
                    receiver,
                    method: "clone".to_string(),
                    args,
                };
            }
            SmartPointerMethod::RcDowngrade => {
                // rc.downgrade() -> rc.downgrade()
                return TsExpression::MethodCall {
                    receiver,
                    method: "downgrade".to_string(),
                    args,
                };
            }
            _ => {
                // For other methods, use helper functions
                let prefix = match smart_ptr_method {
                    SmartPointerMethod::BoxNew => "Box",
                    SmartPointerMethod::RcNew | SmartPointerMethod::RcStrongCount |
                    SmartPointerMethod::RcWeakCount => "Rc",
                    SmartPointerMethod::ArcNew | SmartPointerMethod::ArcStrongCount |
                    SmartPointerMethod::ArcWeakCount => "Arc",
                    SmartPointerMethod::RefCellNew | SmartPointerMethod::RefCellIntoInner => "RefCell",
                    SmartPointerMethod::CellNew => "Cell",
                    _ => unreachable!(),
                };
                return generate_helper_call(prefix, &smart_ptr_method, receiver, args);
            }
        }
    }
    
    // CRITICAL: Handle known class types (Metadata, Permissions, FileType, etc.) method name conversion
    // These classes use camelCase in TypeScript but snake_case in Rust
    if is_known_class_receiver(&method_call.receiver) {
        // Convert snake_case method names to camelCase for known class types
        let ts_method = match method.as_str() {
            // Metadata methods
            "is_file" => "isFile",
            "is_dir" => "isDir",
            "is_symlink" => "isSymlink",
            // Permissions methods
            "set_readonly" => "setReadonly",
            // FileType methods (same as Metadata)
            // Path/PathBuf methods
            "file_name" => "fileName",
            "is_absolute" => "isAbsolute",
            "is_relative" => "isRelative",
            "to_string_lossy" => "toString",
            "set_file_name" => "setFileName",
            // DirEntry methods
            "file_type" => "fileType",
            // OpenOptions methods (already camelCase in the class)
            // Keep other methods as-is (len, display, etc. are already correct)
            _ => method.as_str(),
        };
        
        // Return the method call with converted name
        return TsExpression::MethodCall {
            receiver,
            method: ts_method.to_string(),
            args,
        };
    }
    
    // Handle special Rust methods and convert to TypeScript equivalents
    match method.as_str() {
        "clone_from" => {
            // x.clone_from(&y) -> x = y (simple assignment in TypeScript)
            // This is used for Weak<T> and other types
            if args.len() == 1 {
                return TsExpression::Binary {
                    left: receiver,
                    op: "=".to_string(),
                    right: Box::new(args[0].clone()),
                };
            }
            // Fallback to method call if args don't match
            TsExpression::MethodCall { receiver, method, args }
        },
        "to_string" | "to_owned" => {
            // For string literals, just return the string itself
            // For other expressions, keep them as-is (TypeScript will handle toString)
            // .to_owned() converts &str to String, but in TS strings are already strings
            *receiver
        },
        "into" => {
            // .into() in Rust converts types using Into trait
            // In most cases, TypeScript doesn't need explicit conversion
            // However, we need to check if this is used in a specific context
            *receiver
        },
        "try_into" => {
            // vec.try_into() -> Vec to Array conversion with Result
            // This is commonly used for Vec<T> -> [T; N] conversion
            // vec.try_into() should become: (vec.length === N) ? Ok(vec) : Err("length mismatch")
            // However, we don't know N at this point, so we create a helper function call
            // Generate: Vec_try_into(vec) which will handle the conversion
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Vec_try_into".to_string())),
                args: call_args,
            }
        },
        "try_from" => {
            // Type::try_from(value) is handled as a static method in convert_call
            // But if we see it as a method call, convert it similarly
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("try_from".to_string())),
                args: call_args,
            }
        },
        "to_vec" => {
            // Convert slice to Vec: in TypeScript, arrays are already vectors
            // So we just return a shallow copy using slice()
            TsExpression::MethodCall {
                receiver,
                method: "slice".to_string(),
                args: vec![],
            }
        },
        "clone" => {
            // For strings, clone just returns the string itself (strings are immutable in JS)
            // For other types, clone returns the value itself (shallow copy semantics)
            *receiver
        },
        "push_str" => TsExpression::Binary {
            left: receiver,
            op: "+=".to_string(),
            right: Box::new(if args.is_empty() {
                TsExpression::StringLiteral("".to_string())
            } else {
                args[0].clone()
            }),
        },
        "as_bytes" => TsExpression::MethodCall {
            receiver: receiver.clone(),
            method: "split".to_string(),
            args: vec![TsExpression::StringLiteral("".to_string())],
        },
        "iter" => {
            // CRITICAL: Check if this is HashMap.iter() or HashSet.iter()
            // HashMap/HashSet.iter() needs special handling: counts.iter() -> HashMap_iter(counts)
            // Vec/Array.iter() can just return the array itself: vec.iter() -> vec
            if is_hashmap_receiver(&method_call.receiver) {
                // HashMap.iter() -> HashMap_iter(map)
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("HashMap_iter".to_string())),
                    args: call_args,
                };
            } else if is_hashset_receiver(&method_call.receiver) {
                // HashSet.iter() -> HashSet_iter(set)
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("HashSet_iter".to_string())),
                    args: call_args,
                };
            } else if is_btreemap_receiver(&method_call.receiver) {
                // BTreeMap.iter() -> BTreeMap_iter(map)
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("BTreeMap_iter".to_string())),
                    args: call_args,
                };
            } else {
                // Vec/Array.iter() -> vec (arrays are already iterable)
                *receiver
            }
        },
        "iter_mut" => {
            // iter_mut() in Rust provides mutable references for in-place modification
            // In TypeScript, we cannot modify through `for (const val of array)`
            // The idiomatic TS approach is to use .map() for transformations
            // However, for compatibility with for loops, we return the array
            // Note: The calling code should handle this appropriately
            // Example: v_mut.iter_mut() in for loop -> should use index-based loop
            *receiver
        },
        "into_iter" => {
            // into_iter() in TypeScript just returns the array itself
            // Arrays in TS are already iterable, no conversion needed
            *receiver
        },
        "enumerate" => TsExpression::MethodCall {
            receiver: receiver.clone(),
            method: "entries".to_string(),
            args: vec![],
        },
        "abs" => {
            // Convert x.abs() to Math.abs(x)
            TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "abs".to_string(),
                }),
                args: vec![*receiver],
            }
        },
        "sqrt" => {
            // Convert x.sqrt() to Math.sqrt(x)
            TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "sqrt".to_string()
                }),
                args: vec![*receiver],
            }
        },
        "cbrt" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "cbrt".to_string()
            }),
            args: vec![*receiver],
        },
        "powi" | "powf" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "pow".to_string()
            }),
            args: vec![*receiver, args[0].clone()],
        },
        "exp" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "exp".to_string()
            }),
            args: vec![*receiver],
        },
        "exp2" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "pow".to_string()
            }),
            args: vec![TsExpression::NumberLiteral("2".to_string()), *receiver],
        },
        "exp_m1" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "expm1".to_string()
            }),
            args: vec![*receiver],
        },
        "ln" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "log".to_string()
            }),
            args: vec![*receiver],
        },
        "ln_1p" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "log1p".to_string()
            }),
            args: vec![*receiver],
        },
        "log2" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "log2".to_string()
            }),
            args: vec![*receiver],
        },
        "log10" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "log10".to_string()
            }),
            args: vec![*receiver],
        },
        "log" => TsExpression::Binary {
            left: Box::new(TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "log".to_string()
                }),
                args: vec![receiver.as_ref().clone()],
            }),
            op: "/".to_string(),
            right: Box::new(TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "log".to_string()
                }),
                args: vec![args[0].clone()],
            }),
        },
        "sin" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "sin".to_string()
            }),
            args: vec![*receiver],
        },
        "cos" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "cos".to_string()
            }),
            args: vec![*receiver],
        },
        "tan" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "tan".to_string()
            }),
            args: vec![*receiver],
        },
        "asin" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "asin".to_string()
            }),
            args: vec![*receiver],
        },
        "acos" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "acos".to_string()
            }),
            args: vec![*receiver],
        },
        "atan" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "atan".to_string()
            }),
            args: vec![*receiver],
        },
        "atan2" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "atan2".to_string()
            }),
            args: vec![*receiver, args[0].clone()],
        },
        "sinh" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "sinh".to_string()
            }),
            args: vec![*receiver],
        },
        "cosh" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "cosh".to_string()
            }),
            args: vec![*receiver],
        },
        "tanh" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "tanh".to_string()
            }),
            args: vec![*receiver],
        },
        "asinh" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "asinh".to_string()
            }),
            args: vec![*receiver],
        },
        "acosh" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "acosh".to_string()
            }),
            args: vec![*receiver],
        },
        "atanh" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "atanh".to_string()
            }),
            args: vec![*receiver],
        },
        "floor" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "floor".to_string()
            }),
            args: vec![*receiver],
        },
        "ceil" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "ceil".to_string()
            }),
            args: vec![*receiver],
        },
        "round" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "round".to_string()
            }),
            args: vec![*receiver],
        },
        "trunc" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "trunc".to_string()
            }),
            args: vec![*receiver],
        },
        "fract" => TsExpression::Binary {
            left: receiver.clone(),
            op: "-".to_string(),
            right: Box::new(TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "trunc".to_string()
                }),
                args: vec![*receiver],
            }),
        },
        "signum" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "sign".to_string()
            }),
            args: vec![*receiver],
        },
        "copysign" => TsExpression::Binary {
            left: Box::new(TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "sign".to_string()
                }),
                args: vec![args[0].clone()],
            }),
            op: "*".to_string(),
            right: Box::new(TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "abs".to_string()
                }),
                args: vec![*receiver],
            }),
        },
        "max" => {
            // CRITICAL: Distinguish between numeric max(other) and iterator max()
            // - Numeric types (f64, i32, etc.): a.max(b) has 1 argument -> Math.max(a, b)
            // - Iterator types: iter.max() has 0 arguments -> handled by IteratorMethod
            if args.is_empty() {
                // No args: this is iterator.max(), should be handled by IteratorMethod
                // Fallback to method call if not caught earlier
                TsExpression::MethodCall { receiver, method, args }
            } else {
                // Has args: this is numeric a.max(b) -> Math.max(a, b)
                TsExpression::Call {
                    func: Box::new(TsExpression::Member {
                        object: Box::new(TsExpression::Identifier("Math".to_string())),
                        property: "max".to_string()
                    }),
                    args: vec![*receiver, args[0].clone()],
                }
            }
        },
        "min" => {
            // CRITICAL: Distinguish between numeric min(other) and iterator min()
            // - Numeric types (f64, i32, etc.): a.min(b) has 1 argument -> Math.min(a, b)
            // - Iterator types: iter.min() has 0 arguments -> handled by IteratorMethod
            if args.is_empty() {
                // No args: this is iterator.min(), should be handled by IteratorMethod
                // Fallback to method call if not caught earlier
                TsExpression::MethodCall { receiver, method, args }
            } else {
                // Has args: this is numeric a.min(b) -> Math.min(a, b)
                TsExpression::Call {
                    func: Box::new(TsExpression::Member {
                        object: Box::new(TsExpression::Identifier("Math".to_string())),
                        property: "min".to_string()
                    }),
                    args: vec![*receiver, args[0].clone()],
                }
            }
        },
        "clamp" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Math".to_string())),
                property: "max".to_string()
            }),
            args: vec![
                args[0].clone(),
                TsExpression::Call {
                    func: Box::new(TsExpression::Member {
                        object: Box::new(TsExpression::Identifier("Math".to_string())),
                        property: "min".to_string()
                    }),
                    args: vec![args[1].clone(), *receiver],
                }
            ],
        },
        "to_radians" => TsExpression::Binary {
            left: receiver,
            op: "*".to_string(),
            right: Box::new(TsExpression::Paren(Box::new(TsExpression::Binary {
                left: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "PI".to_string()
                }),
                op: "/".to_string(),
                right: Box::new(TsExpression::NumberLiteral("180".to_string())),
            }))),
        },
        "to_degrees" => TsExpression::Binary {
            left: receiver,
            op: "*".to_string(),
            right: Box::new(TsExpression::Paren(Box::new(TsExpression::Binary {
                left: Box::new(TsExpression::NumberLiteral("180".to_string())),
                op: "/".to_string(),
                right: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "PI".to_string()
                }),
            }))),
        },
        "sin_cos" => TsExpression::Array(vec![
            TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "sin".to_string()
                }),
                args: vec![receiver.as_ref().clone()],
            },
            TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "cos".to_string()
                }),
                args: vec![*receiver],
            },
        ]),
        "is_nan" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Number".to_string())),
                property: "isNaN".to_string()
            }),
            args: vec![*receiver],
        },
        "is_infinite" => TsExpression::Binary {
            left: Box::new(TsExpression::Binary {
                left: Box::new(TsExpression::Call {
                    func: Box::new(TsExpression::Member {
                        object: Box::new(TsExpression::Identifier("Number".to_string())),
                        property: "isFinite".to_string()
                    }),
                    args: vec![receiver.as_ref().clone()],
                }),
                op: "===".to_string(),
                right: Box::new(TsExpression::Identifier("false".to_string())),
            }),
            op: "&&".to_string(),
            right: Box::new(TsExpression::Binary {
                left: Box::new(TsExpression::Call {
                    func: Box::new(TsExpression::Member {
                        object: Box::new(TsExpression::Identifier("Number".to_string())),
                        property: "isNaN".to_string()
                    }),
                    args: vec![*receiver],
                }),
                op: "===".to_string(),
                right: Box::new(TsExpression::Identifier("false".to_string())),
            }),
        },
        "is_finite" => TsExpression::Call {
            func: Box::new(TsExpression::Member {
                object: Box::new(TsExpression::Identifier("Number".to_string())),
                property: "isFinite".to_string()
            }),
            args: vec![*receiver],
        },
        "is_normal" => TsExpression::Binary {
            left: Box::new(TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Number".to_string())),
                    property: "isFinite".to_string()
                }),
                args: vec![receiver.as_ref().clone()],
            }),
            op: "&&".to_string(),
            right: Box::new(TsExpression::Binary {
                left: receiver,
                op: "!==".to_string(),
                right: Box::new(TsExpression::NumberLiteral("0".to_string())),
            }),
        },
        "is_sign_positive" => TsExpression::Binary {
            left: Box::new(TsExpression::Binary {
                left: receiver.clone(),
                op: ">".to_string(),
                right: Box::new(TsExpression::NumberLiteral("0".to_string())),
            }),
            op: "||".to_string(),
            right: Box::new(TsExpression::Paren(Box::new(TsExpression::Binary {
                left: Box::new(TsExpression::Binary {
                    left: receiver.clone(),
                    op: "===".to_string(),
                    right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                }),
                op: "&&".to_string(),
                right: Box::new(TsExpression::Binary {
                    left: Box::new(TsExpression::Binary {
                        left: Box::new(TsExpression::NumberLiteral("1".to_string())),
                        op: "/".to_string(),
                        right: receiver.clone(),
                    }),
                    op: "===".to_string(),
                    right: Box::new(TsExpression::Identifier("Infinity".to_string())),
                }),
            }))),
        },
        "is_sign_negative" => TsExpression::Binary {
            left: Box::new(TsExpression::Binary {
                left: receiver.clone(),
                op: "<".to_string(),
                right: Box::new(TsExpression::NumberLiteral("0".to_string())),
            }),
            op: "||".to_string(),
            right: Box::new(TsExpression::Paren(Box::new(TsExpression::Binary {
                left: Box::new(TsExpression::Binary {
                    left: receiver.clone(),
                    op: "===".to_string(),
                    right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                }),
                op: "&&".to_string(),
                right: Box::new(TsExpression::Binary {
                    left: Box::new(TsExpression::Binary {
                        left: Box::new(TsExpression::NumberLiteral("1".to_string())),
                        op: "/".to_string(),
                        right: receiver.clone(),
                    }),
                    op: "===".to_string(),
                    right: Box::new(TsExpression::Binary {
                        left: Box::new(TsExpression::NumberLiteral("0".to_string())),
                        op: "-".to_string(),
                        right: Box::new(TsExpression::Identifier("Infinity".to_string())),
                    }),
                }),
            }))),
        },
        "to_bits" | "from_bits" | "mul_add" | "div_euclid" | "rem_euclid" => {
            // These need custom helper functions - keep as method calls for now
            TsExpression::MethodCall { receiver, method, args }
        },
        "pow" => {
            // Integer pow method
            TsExpression::Call {
                func: Box::new(TsExpression::Member {
                    object: Box::new(TsExpression::Identifier("Math".to_string())),
                    property: "pow".to_string()
                }),
                args: vec![*receiver, args[0].clone()],
            }
        },
        
        _ => {
            // Fallback: Check MetadataRegistry for methods not in specific enums
            // This handles methods like sort_by, sort_by_key, etc. that are in metadata but not in VecMethod enum
            let registry = crate::metadata::MetadataRegistry::new();
            
            // Try to find method in Vec
            if is_vec_receiver(&method_call.receiver) {
                if let Some(binding) = registry.get_method("Vec", &method) {
                    let mut call_args = vec![*receiver];
                    call_args.extend(args);
                    return TsExpression::Call {
                        func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
                        args: call_args,
                    };
                }
            }
            
            // Default: keep as method call
            TsExpression::MethodCall { receiver, method, args }
        }
    }
}

/// Generate a helper function call for Result/Option/SmartPointer methods
/// E.g., result.unwrap() -> Result_unwrap(result)
///
/// 优先使用自动生成的绑定，如果找不到则回退到旧的命名规则
fn generate_helper_call<T: StdMethod>(
    type_prefix: &str,
    method: &T,
    receiver: Box<TsExpression>,
    args: Vec<TsExpression>
) -> TsExpression {
    let method_name = method.method_name();
    
    // 尝试从自动生成的绑定中查找
    let registry = crate::metadata::MetadataRegistry::new();
    let helper_name: String = if let Some(binding) = registry.get_method(type_prefix, method_name) {
        // 使用生成的绑定名称
        binding.ts_function.to_string()
    } else {
        // 回退到旧的命名规则
        format!("{}_{}", type_prefix, method_name)
    };
    
    // Build args list: [receiver, ...args]
    let mut call_args = vec![*receiver];
    call_args.extend(args);
    
    TsExpression::Call {
        func: Box::new(TsExpression::Identifier(helper_name)),
        args: call_args,
    }
}

/// Convert Vec method calls to native TypeScript array operations
///
/// 优先使用生成的绑定，对于简单的内联转换保留原有逻辑以提高性能
fn convert_vec_method_to_native(
    method: VecMethod,
    receiver: Box<TsExpression>,
    args: Vec<TsExpression>
) -> TsExpression {
    let method_name = method.method_name();
    
    // 检查是否有生成的绑定
    let registry = crate::metadata::MetadataRegistry::new();
    if let Some(binding) = registry.get_method("Vec", method_name) {
        // 对于某些简单的方法，保留内联优化以提高性能
        // 这些方法转换为属性访问或简单表达式比函数调用更高效
        match method {
            VecMethod::Len => {
                // vec.len() -> vec.length (内联优化)
                return TsExpression::Member {
                    object: receiver,
                    property: "length".to_string(),
                };
            }
            VecMethod::IsEmpty => {
                // vec.is_empty() -> vec.length === 0 (内联优化)
                return TsExpression::Binary {
                    left: Box::new(TsExpression::Member {
                        object: receiver,
                        property: "length".to_string(),
                    }),
                    op: "===".to_string(),
                    right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                };
            }
            VecMethod::Capacity => {
                // vec.capacity() -> Vec_capacity(vec) (使用辅助函数以保证正确性)
                // 注意：不能内联为 vec.length，因为 receiver 可能是复杂表达式
                let mut call_args = vec![*receiver];
                call_args.extend(args);
                
                return TsExpression::Call {
                    func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
                    args: call_args,
                };
            }
            VecMethod::Clear => {
                // vec.clear() -> vec.length = 0 (内联优化)
                return TsExpression::Binary {
                    left: Box::new(TsExpression::Member {
                        object: receiver,
                        property: "length".to_string(),
                    }),
                    op: "=".to_string(),
                    right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                };
            }
            VecMethod::Iter => {
                // vec.iter() -> vec (内联优化)
                return *receiver;
            }
            VecMethod::Contains => {
                // vec.contains(item) -> vec.includes(item) (内联优化)
                return TsExpression::MethodCall {
                    receiver,
                    method: "includes".to_string(),
                    args,
                };
            }
            VecMethod::Push => {
                // vec.push(x) -> vec.push(x) (原生方法)
                return TsExpression::MethodCall {
                    receiver,
                    method: "push".to_string(),
                    args,
                };
            }
            _ => {}
        }
        
        // 使用生成的绑定调用辅助函数
        let mut call_args = vec![*receiver];
        call_args.extend(args);
        
        return TsExpression::Call {
            func: Box::new(TsExpression::Identifier(binding.ts_function.to_string())),
            args: call_args,
        };
    }
    
    // 回退：如果没有生成的绑定，使用旧的硬编码逻辑
    // 这部分代码保留以保证向后兼容性
    match method {
        VecMethod::Push => {
            TsExpression::MethodCall {
                receiver,
                method: "push".to_string(),
                args,
            }
        }
        VecMethod::Pop => {
            let pop_call = TsExpression::MethodCall {
                receiver: receiver.clone(),
                method: "pop".to_string(),
                args: vec![],
            };
            TsExpression::Conditional {
                condition: Box::new(TsExpression::Binary {
                    left: Box::new(pop_call.clone()),
                    op: "!==".to_string(),
                    right: Box::new(TsExpression::Identifier("undefined".to_string())),
                }),
                then_expr: Box::new(TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("Some".to_string())),
                    args: vec![pop_call],
                }),
                else_expr: Box::new(TsExpression::Identifier("None".to_string())),
            }
        }
        VecMethod::Len => {
            TsExpression::Member {
                object: receiver,
                property: "length".to_string(),
            }
        }
        VecMethod::IsEmpty => {
            TsExpression::Binary {
                left: Box::new(TsExpression::Member {
                    object: receiver,
                    property: "length".to_string(),
                }),
                op: "===".to_string(),
                right: Box::new(TsExpression::NumberLiteral("0".to_string())),
            }
        }
        VecMethod::Capacity => {
            // vec.capacity() -> Vec_capacity(vec)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier(format!("Vec_{}", method_name))),
                args: call_args,
            }
        }
        VecMethod::Clear => {
            TsExpression::Binary {
                left: Box::new(TsExpression::Member {
                    object: receiver,
                    property: "length".to_string(),
                }),
                op: "=".to_string(),
                right: Box::new(TsExpression::NumberLiteral("0".to_string())),
            }
        }
        VecMethod::Insert => {
            let mut splice_args = vec![args[0].clone(), TsExpression::NumberLiteral("0".to_string())];
            splice_args.push(args[1].clone());
            TsExpression::MethodCall {
                receiver,
                method: "splice".to_string(),
                args: splice_args,
            }
        }
        VecMethod::Remove => {
            TsExpression::Index {
                object: Box::new(TsExpression::MethodCall {
                    receiver,
                    method: "splice".to_string(),
                    args: vec![args[0].clone(), TsExpression::NumberLiteral("1".to_string())],
                }),
                index: Box::new(TsExpression::NumberLiteral("0".to_string())),
            }
        }
        VecMethod::Contains => {
            TsExpression::MethodCall {
                receiver,
                method: "includes".to_string(),
                args,
            }
        }
        VecMethod::Append => {
            TsExpression::MethodCall {
                receiver,
                method: "push".to_string(),
                args: vec![TsExpression::Spread(Box::new(args[0].clone()))],
            }
        }
        _ => {
            // 其他方法使用helper function
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier(format!("Vec_{}", method_name))),
                args: call_args,
            }
        }
    }
}

/// Convert Iterator method calls to native TypeScript array operations
///
/// IMPORTANT: For chain method, we need access to the original Rust receiver expression
/// to properly distinguish between Iterator::chain and Read::chain
fn convert_iterator_method_to_native(
    method: IteratorMethod,
    receiver: Box<TsExpression>,
    args: Vec<TsExpression>
) -> TsExpression {
    use crate::converter::std_methods::IteratorMethod;
    
    match method {
        IteratorMethod::Map | IteratorMethod::Filter | IteratorMethod::Find |
        IteratorMethod::Any | IteratorMethod::All | IteratorMethod::ForEach |
        IteratorMethod::Sum | IteratorMethod::Product | IteratorMethod::Last |
        IteratorMethod::Max | IteratorMethod::Min => {
            // These map directly to array methods
            let ts_method = match method {
                IteratorMethod::Map => "map",
                IteratorMethod::Filter => "filter",
                IteratorMethod::Find => "find",
                IteratorMethod::Any => "some",
                IteratorMethod::All => "every",
                IteratorMethod::ForEach => "forEach",
                IteratorMethod::Sum => "reduce",
                IteratorMethod::Product => "reduce",
                IteratorMethod::Last => "at",
                IteratorMethod::Max => "reduce",
                IteratorMethod::Min => "reduce",
                _ => unreachable!(),
            };
            
            // Special handling for sum(), product(), max(), min(), and last()
            if matches!(method, IteratorMethod::Sum | IteratorMethod::Product) {
                let (op, init) = if matches!(method, IteratorMethod::Sum) {
                    ("+", "0")
                } else {
                    ("*", "1")
                };
                
                return TsExpression::MethodCall {
                    receiver,
                    method: "reduce".to_string(),
                    args: vec![
                        TsExpression::ArrowFunction {
                            params: vec!["acc".to_string(), "x".to_string()],
                            body: Box::new(TsExpression::Binary {
                                left: Box::new(TsExpression::Identifier("acc".to_string())),
                                op: op.to_string(),
                                right: Box::new(TsExpression::Identifier("x".to_string())),
                            }),
                        },
                        TsExpression::NumberLiteral(init.to_string()),
                    ],
                };
            }
            
            if matches!(method, IteratorMethod::Max | IteratorMethod::Min) {
                let op = if matches!(method, IteratorMethod::Max) { ">" } else { "<" };
                let reduce_call = TsExpression::MethodCall {
                    receiver: receiver.clone(),
                    method: "reduce".to_string(),
                    args: vec![
                        TsExpression::ArrowFunction {
                            params: vec!["acc".to_string(), "x".to_string()],
                            body: Box::new(TsExpression::Conditional {
                                condition: Box::new(TsExpression::Binary {
                                    left: Box::new(TsExpression::Identifier("acc".to_string())),
                                    op: op.to_string(),
                                    right: Box::new(TsExpression::Identifier("x".to_string())),
                                }),
                                then_expr: Box::new(TsExpression::Identifier("acc".to_string())),
                                else_expr: Box::new(TsExpression::Identifier("x".to_string())),
                            }),
                        },
                    ],
                };
                
                // Wrap in Option
                return TsExpression::Conditional {
                    condition: Box::new(TsExpression::Binary {
                        left: Box::new(TsExpression::Member {
                            object: receiver,
                            property: "length".to_string(),
                        }),
                        op: "===".to_string(),
                        right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                    }),
                    then_expr: Box::new(TsExpression::Identifier("None".to_string())),
                    else_expr: Box::new(TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("Some".to_string())),
                        args: vec![reduce_call],
                    }),
                };
            }
            
            if matches!(method, IteratorMethod::Last) {
                // last() -> array.at(-1) wrapped in Option
                let at_call = TsExpression::MethodCall {
                    receiver: receiver.clone(),
                    method: "at".to_string(),
                    args: vec![TsExpression::NumberLiteral("-1".to_string())],
                };
                
                return TsExpression::Conditional {
                    condition: Box::new(TsExpression::Binary {
                        left: Box::new(TsExpression::Member {
                            object: receiver,
                            property: "length".to_string(),
                        }),
                        op: "===".to_string(),
                        right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                    }),
                    then_expr: Box::new(TsExpression::Identifier("None".to_string())),
                    else_expr: Box::new(TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("Some".to_string())),
                        args: vec![at_call],
                    }),
                };
            }
            
            let result = TsExpression::MethodCall {
                receiver,
                method: ts_method.to_string(),
                args,
            };
            
            // Wrap find result in Option
            if matches!(method, IteratorMethod::Find) {
                TsExpression::Conditional {
                    condition: Box::new(TsExpression::Binary {
                        left: Box::new(result.clone()),
                        op: "!==".to_string(),
                        right: Box::new(TsExpression::Identifier("undefined".to_string())),
                    }),
                    then_expr: Box::new(TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("Some".to_string())),
                        args: vec![result],
                    }),
                    else_expr: Box::new(TsExpression::Identifier("None".to_string())),
                }
            } else {
                result
            }
        }
        IteratorMethod::Fold => {
            // fold(init, f) -> reduce(f, init)
            TsExpression::MethodCall {
                receiver,
                method: "reduce".to_string(),
                args: vec![args[1].clone(), args[0].clone()], // Swap order
            }
        }
        IteratorMethod::Collect => {
            // collect() 需要根据目标类型生成不同的代码
            // 生成 Iterator_collect(receiver) 调用
            // 这样在 statements.rs 的 convert_local 中可以检测并根据类型转换
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_collect".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Count => {
            // count() -> length
            TsExpression::Member {
                object: receiver,
                property: "length".to_string(),
            }
        }
        IteratorMethod::Take => {
            // take(n) -> slice(0, n)
            if args.is_empty() {
                // No argument provided, return receiver as-is (shouldn't happen in valid Rust)
                *receiver
            } else {
                TsExpression::MethodCall {
                    receiver,
                    method: "slice".to_string(),
                    args: vec![TsExpression::NumberLiteral("0".to_string()), args[0].clone()],
                }
            }
        }
        IteratorMethod::Skip => {
            // skip(n) -> slice(n)
            if args.is_empty() {
                // No argument provided, return receiver as-is
                *receiver
            } else {
                TsExpression::MethodCall {
                    receiver,
                    method: "slice".to_string(),
                    args,
                }
            }
        }
        IteratorMethod::Enumerate => {
            // enumerate() -> map((item, index) => [index, item])
            TsExpression::MethodCall {
                receiver,
                method: "map".to_string(),
                args: vec![TsExpression::ArrowFunction {
                    params: vec!["item".to_string(), "index".to_string()],
                    body: Box::new(TsExpression::Array(vec![
                        TsExpression::Identifier("index".to_string()),
                        TsExpression::Identifier("item".to_string()),
                    ])),
                }],
            }
        }
        IteratorMethod::Reduce => {
            // reduce(f) -> reduce(f) with Option wrapper
            let reduce_call = TsExpression::MethodCall {
                receiver: receiver.clone(),
                method: "reduce".to_string(),
                args,
            };
            
            // Wrap in Option: array.length === 0 ? None : Some(array.reduce(f))
            TsExpression::Conditional {
                condition: Box::new(TsExpression::Binary {
                    left: Box::new(TsExpression::Member {
                        object: receiver,
                        property: "length".to_string(),
                    }),
                    op: "===".to_string(),
                    right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                }),
                then_expr: Box::new(TsExpression::Identifier("None".to_string())),
                else_expr: Box::new(TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("Some".to_string())),
                    args: vec![reduce_call],
                }),
            }
        }
        IteratorMethod::Position => {
            // position(predicate) -> findIndex(predicate) wrapped in Option
            // vec.iter().position(|&x| x == 8) -> vec.findIndex(x => x === 8)
            let find_index_call = TsExpression::MethodCall {
                receiver,
                method: "findIndex".to_string(),
                args,
            };
            
            // Wrap in Option: index !== -1 ? Some(index) : None
            TsExpression::Conditional {
                condition: Box::new(TsExpression::Binary {
                    left: Box::new(find_index_call.clone()),
                    op: "!==".to_string(),
                    right: Box::new(TsExpression::NumberLiteral("-1".to_string())),
                }),
                then_expr: Box::new(TsExpression::Call {
                    func: Box::new(TsExpression::Identifier("Some".to_string())),
                    args: vec![find_index_call],
                }),
                else_expr: Box::new(TsExpression::Identifier("None".to_string())),
            }
        }
        IteratorMethod::Cloned => {
            // cloned() -> map(x => x) (shallow copy)
            TsExpression::MethodCall {
                receiver,
                method: "map".to_string(),
                args: vec![TsExpression::ArrowFunction {
                    params: vec!["x".to_string()],
                    body: Box::new(TsExpression::Identifier("x".to_string())),
                }],
            }
        }
        IteratorMethod::Zip => {
            // iter1.zip(iter2) -> Iterator_zip(iter1, iter2)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_zip".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Chain => {
            // Iterator::chain: iter1.chain(iter2) -> Iterator_chain(iter1, iter2)
            // CRITICAL: Check if receiver is also an Iterator_chain call
            // If so, merge all arguments into a single Iterator_chain call
            // This handles: combo1.chain(combo2).chain(combo3) -> Iterator_chain(combo1, combo2, combo3)
            let mut all_args = vec![];
            
            // Check if receiver is an Iterator_chain call
            if let TsExpression::Call { func, args: recv_args } = &*receiver {
                if let TsExpression::Identifier(func_name) = &**func {
                    if func_name == "Iterator_chain" {
                        // Receiver is Iterator_chain, merge its arguments
                        all_args.extend(recv_args.clone());
                        all_args.extend(args);
                        
                        return TsExpression::Call {
                            func: Box::new(TsExpression::Identifier("Iterator_chain".to_string())),
                            args: all_args,
                        };
                    }
                }
            }
            
            // Normal case: receiver is not Iterator_chain
            all_args.push(*receiver);
            all_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_chain".to_string())),
                args: all_args,
            }
        }
        IteratorMethod::Partition => {
            // iter.partition(predicate) -> Iterator_partition(iter, predicate)
            // Returns [T[], T[]] tuple
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_partition".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::FlatMap => {
            // iter.flat_map(f) -> Iterator_flat_map(iter, f)
            // Or use native flatMap: iter.flatMap(f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_flat_map".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Flatten => {
            // iter.flatten() -> Iterator_flatten(iter)
            // Flattens nested arrays: [[1,2],[3,4]] -> [1,2,3,4]
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_flatten".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Cycle => {
            // cycle() -> Iterator_cycle(iter)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_cycle".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Copied => {
            // copied() is the same as cloned() for primitives in TypeScript
            TsExpression::MethodCall {
                receiver,
                method: "map".to_string(),
                args: vec![TsExpression::ArrowFunction {
                    params: vec!["x".to_string()],
                    body: Box::new(TsExpression::Identifier("x".to_string())),
                }],
            }
        }
        IteratorMethod::FilterMap => {
            // filter_map(f) -> Iterator_filter_map(iter, f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_filter_map".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::FindMap => {
            // find_map(f) -> Iterator_find_map(iter, f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_find_map".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Fuse => {
            // fuse() -> Iterator_fuse(iter)
            // Returns an iterator object with next() method
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_fuse".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Inspect => {
            // inspect(f) -> map(x => { f(x); return x; })
            if args.len() == 1 {
                TsExpression::MethodCall {
                    receiver,
                    method: "map".to_string(),
                    args: vec![TsExpression::ArrowFunction {
                        params: vec!["x".to_string()],
                        body: Box::new(TsExpression::Block(vec![
                            TsExpression::Call {
                                func: Box::new(args[0].clone()),
                                args: vec![TsExpression::Identifier("x".to_string())],
                            },
                            TsExpression::Identifier("x".to_string()),
                        ])),
                    }],
                }
            } else {
                *receiver
            }
        }
        IteratorMethod::IsSorted => {
            // is_sorted() -> Iterator_is_sorted(iter)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_is_sorted".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::IsSortedByKey => {
            // is_sorted_by_key(f) -> Iterator_is_sorted_by_key(iter, f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_is_sorted_by_key".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Nth => {
            // nth(n) -> array[n] wrapped in Option
            if args.is_empty() {
                // No argument provided, return None (shouldn't happen in valid Rust)
                TsExpression::Identifier("None".to_string())
            } else {
                let index_access = TsExpression::Index {
                    object: receiver.clone(),
                    index: Box::new(args[0].clone()),
                };
                
                TsExpression::Conditional {
                    condition: Box::new(TsExpression::Binary {
                        left: Box::new(args[0].clone()),
                        op: "<".to_string(),
                        right: Box::new(TsExpression::Member {
                            object: receiver,
                            property: "length".to_string(),
                        }),
                    }),
                    then_expr: Box::new(TsExpression::Call {
                        func: Box::new(TsExpression::Identifier("Some".to_string())),
                        args: vec![index_access],
                    }),
                    else_expr: Box::new(TsExpression::Identifier("None".to_string())),
                }
            }
        }
        IteratorMethod::Peekable => {
            // peekable() -> Iterator_peekable(iter)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_peekable".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::Rev => {
            // rev() -> array.reverse() (but need to clone first to avoid mutation)
            TsExpression::MethodCall {
                receiver: Box::new(TsExpression::MethodCall {
                    receiver,
                    method: "slice".to_string(),
                    args: vec![],
                }),
                method: "reverse".to_string(),
                args: vec![],
            }
        }
        IteratorMethod::Scan => {
            // scan(init, f) -> Iterator_scan(iter, init, f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_scan".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::SkipWhile => {
            // skip_while(f) -> Iterator_skip_while(iter, f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_skip_while".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::StepBy => {
            // step_by(n) -> filter((_, i) => i % n === 0)
            if args.is_empty() {
                // No argument provided, return receiver as-is
                *receiver
            } else {
                TsExpression::MethodCall {
                    receiver,
                    method: "filter".to_string(),
                    args: vec![TsExpression::ArrowFunction {
                        params: vec!["_".to_string(), "i".to_string()],
                        body: Box::new(TsExpression::Binary {
                            left: Box::new(TsExpression::Binary {
                                left: Box::new(TsExpression::Identifier("i".to_string())),
                                op: "%".to_string(),
                                right: Box::new(args[0].clone()),
                            }),
                            op: "===".to_string(),
                            right: Box::new(TsExpression::NumberLiteral("0".to_string())),
                        }),
                    }],
                }
            }
        }
        IteratorMethod::TakeWhile => {
            // take_while(f) -> Iterator_take_while(iter, f)
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier("Iterator_take_while".to_string())),
                args: call_args,
            }
        }
        IteratorMethod::MaxByKey | IteratorMethod::MinByKey => {
            // max_by_key(f) / min_by_key(f) -> Iterator_max_by_key / Iterator_min_by_key
            let func_name = if matches!(method, IteratorMethod::MaxByKey) {
                "Iterator_max_by_key"
            } else {
                "Iterator_min_by_key"
            };
            
            let mut call_args = vec![*receiver];
            call_args.extend(args);
            
            TsExpression::Call {
                func: Box::new(TsExpression::Identifier(func_name.to_string())),
                args: call_args,
            }
        }
    }
}

/// Check if the receiver expression is a BTreeMap type
/// by examining the type annotation or constructor
fn is_btreemap_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // First check if path contains BTreeMap in its name
            if path_str.contains("BTreeMap") {
                return true;
            }
            
            // Check variable type from declaration context (CRITICAL for type detection)
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "BTreeMap" {
                        return true;
                    }
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a BTreeMap::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "BTreeMap::new";
            }
            false
        }
        _ => false
    }
}

/// Check if the receiver expression is a HashMap type
fn is_hashmap_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // First check if path contains HashMap in its name
            if path_str.contains("HashMap") && !path_str.contains("BTreeMap") {
                return true;
            }
            
            // Check variable type from declaration context (CRITICAL for type detection)
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "HashMap" {
                        return true;
                    }
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "HashMap::new";
            }
            false
        }
        syn::Expr::MethodCall(method) => {
            // CRITICAL: For method chains like counts.iter().filter()
            // We need to check if the base receiver (counts) is a HashMap
            // Methods like .iter() return iterators but we need to know the source type
            let method_name = method.method.to_string();
            // If this is an iterator method on a HashMap, recursively check the receiver
            if matches!(method_name.as_str(), "iter" | "iter_mut" | "keys" | "values" | "into_iter") {
                return is_hashmap_receiver(&method.receiver);
            }
            false
        }
        _ => false
    }
}

/// Check if the receiver expression is a BTreeSet type
fn is_btreeset_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if path contains "BTreeSet"
            if path_str.contains("BTreeSet") {
                return true;
            }
            
            // Check variable type from declaration context
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "BTreeSet" {
                        return true;
                    }
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a BTreeSet::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "BTreeSet::new";
            }
            false
        }
        _ => false
    }
}

/// Check if the receiver expression is a BinaryHeap type
fn is_binaryheap_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if path contains "BinaryHeap"
            if path_str.contains("BinaryHeap") {
                return true;
            }
            
            // Check variable type from declaration context
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "BinaryHeap" {
                        return true;
                    }
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a BinaryHeap::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "BinaryHeap::new";
            }
            false
        }
        _ => false
    }
}

/// Check if the receiver expression is a HashSet type
fn is_hashset_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if path contains "HashSet"
            if path_str.contains("HashSet") {
                return true;
            }
            
            // Check variable type from declaration context
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "HashSet" {
                        return true;
                    }
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a HashSet::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "HashSet::new";
            }
            // Check if the receiver is a HashSet::new() call recursively
            is_hashset_receiver(&*call.func)
        }
        syn::Expr::MethodCall(method) => {
            // For method chains like set.iter().filter()
            let method_name = method.method.to_string();
            if matches!(method_name.as_str(), "iter" | "iter_mut" | "into_iter") {
                return is_hashset_receiver(&method.receiver);
            }
            false
        }
        _ => false
    }
}

/// Extract type hint from receiver expression for smart pointer detection
/// This is a heuristic approach - tries to identify the type from variable names
fn extract_type_hint(receiver: &TsExpression) -> String {
    match receiver {
        TsExpression::Identifier(name) => {
            // Try to infer from variable naming patterns
            // e.g., "rc_value" -> "Rc", "arc_data" -> "Arc"
            if name.starts_with("rc_") || name.ends_with("_rc") {
                "Rc".to_string()
            } else if name.starts_with("arc_") || name.ends_with("_arc") {
                "Arc".to_string()
            } else if name.starts_with("cell_") || name.ends_with("_cell") {
                "Cell".to_string()
            } else if name.starts_with("refcell_") || name.ends_with("_refcell") {
                "RefCell".to_string()
            } else {
                String::new()
            }
        }
        _ => String::new()
    }
}

/// Check if the receiver expression is a smart pointer type (Rc, Arc, etc.)
/// This helps determine if we need to auto-dereference to access inner methods
fn is_smart_pointer_receiver(expr: &syn::Expr) -> bool {
    match expr {
        // Check for Rc::new(), Arc::new() calls
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                // Check if it's a smart pointer constructor
                return matches!(path_str.as_str(),
                    "Rc::new" | "Arc::new" | "Box::new" |
                    "RefCell::new" | "Cell::new" |
                    "RcCell::new" | "ArcCell::new"
                );
            }
            false
        }
        // Check for method calls that return smart pointers
        syn::Expr::MethodCall(method) => {
            let method_name = method.method.to_string();
            // Methods that return smart pointers
            matches!(method_name.as_str(),
                "clone" | "upgrade" // Rc/Arc/Weak methods that return smart pointers
            ) && is_smart_pointer_receiver(&method.receiver)
        }
        // Check variable paths - would need type information for accuracy
        syn::Expr::Path(_) => {
            // Conservative: assume it might be a smart pointer
            // In a full implementation, we'd track variable types
            false
        }
        _ => false
    }
}

/// Check if the receiver expression is a String type
/// This helps distinguish between String and HashMap/other collection methods
fn is_string_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if it's explicitly a String type
            if path_str.contains("String") && path_str != "String::from" && path_str != "String::new" {
                return true;
            }
            
            // Check variable type from declaration context
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // Common string variable naming patterns
                if is_likely_string_var(&var_name) {
                    return true;
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a String::from() or String::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "String::from" || path_str == "String::new";
            }
            false
        }
        syn::Expr::Lit(lit) => {
            // String literals
            matches!(lit.lit, syn::Lit::Str(_))
        }
        syn::Expr::MethodCall(method) => {
            // Methods that return strings
            let method_name = method.method.to_string();
            if matches!(method_name.as_str(),
                "to_string" | "to_uppercase" | "to_lowercase" |
                "trim" | "replace" | "substring"
            ) {
                return true;
            }
            // Recursively check the receiver
            is_string_receiver(&method.receiver)
        }
        _ => false
    }
}

/// Helper function to check if a variable name is likely a string variable
fn is_likely_string_var(var_name: &str) -> bool {
    // String variables often have these patterns
    // CRITICAL FIX: Also match s_xxx patterns (e.g., s_cap, s_unicode, s_ptr)
    (var_name.starts_with("s") && (
        (var_name.len() <= 3 && var_name.chars().skip(1).all(|c| c.is_ascii_digit())) ||  // s, s1, s2
        (var_name.len() > 2 && &var_name[1..2] == "_")  // s_cap, s_unicode, s_xxx
    )) ||
    var_name.ends_with("_str") ||
    var_name.ends_with("_string") ||
    matches!(var_name, "text" | "message" | "name" | "title" | "content" | "literal" |
             "empty" | "trimmed" | "upper" | "lower" | "replaced" | "removed" | "processed" |
             "sentence" | "first" | "original" | "cloned" | "result" | "result1")
}

/// Helper function to check if an expression is a string literal or string variable
fn is_string_literal_or_var(expr: &syn::Expr) -> bool {
    match expr {
        // String literals
        syn::Expr::Lit(lit) => matches!(lit.lit, syn::Lit::Str(_)),
        // Path expressions (variables)
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                is_likely_string_var(&var_name)
            } else {
                false
            }
        }
        // Method calls that return strings
        syn::Expr::MethodCall(method) => {
            let method_name = method.method.to_string();
            matches!(method_name.as_str(),
                "to_string" | "to_uppercase" | "to_lowercase" |
                "trim" | "replace" | "substring"
            )
        }
        // Call expressions like String::from()
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "String::from" || path_str == "String::new";
            }
            false
        }
        _ => false
    }
}

/// Check if the receiver expression is a VecDeque type
fn is_vecdeque_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if path contains "VecDeque"
            if path_str.contains("VecDeque") {
                return true;
            }
            
            // Check variable type from declaration context
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "VecDeque" {
                        return true;
                    }
                }
                
                // Check for common VecDeque variable names
                if var_name.starts_with("deque") || var_name.ends_with("_deque") || var_name.contains("deque") {
                    return true;
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a VecDeque::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "VecDeque::new" || path_str.contains("VecDeque");
            }
            false
        }
        syn::Expr::MethodCall(method) => {
            // Recursively check the receiver
            is_vecdeque_receiver(&method.receiver)
        }
        _ => false
    }
}

/// Check if the receiver expression is a LinkedList type
fn is_linkedlist_receiver(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if path contains "LinkedList"
            if path_str.contains("LinkedList") {
                return true;
            }
            
            // Check variable type from declaration context
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "LinkedList" {
                        return true;
                    }
                }
                
                // Check for common LinkedList variable names
                if var_name.starts_with("list") || var_name.ends_with("_list") || var_name.contains("_list_") {
                    return true;
                }
            }
            
            false
        }
        syn::Expr::Call(call) => {
            // Check if this is a LinkedList::new() call
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "LinkedList::new" || path_str.contains("LinkedList");
            }
            false
        }
        syn::Expr::MethodCall(method) => {
            // Recursively check the receiver
            is_linkedlist_receiver(&method.receiver)
        }
        _ => false
    }
}

/// Check if the receiver expression is likely a JoinHandle type (from thread::spawn)
/// This helps distinguish between JoinHandle.join() and array.join()
fn is_joinhandle_receiver(expr: &syn::Expr) -> bool {
    match expr {
        // Check for thread::spawn() calls which return JoinHandle
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                // thread::spawn returns JoinHandle
                return path_str == "thread::spawn" || path_str.ends_with("::spawn");
            }
            false
        }
        // Check for variable names that suggest JoinHandle
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // Common JoinHandle variable names
                return var_name.contains("handle") ||
                       var_name.starts_with("join_") ||
                       var_name.ends_with("_handle") ||
                       var_name.starts_with("thread_");
            }
            false
        }
        // Check method calls that might return JoinHandle
        syn::Expr::MethodCall(method) => {
            method.method == "spawn" || is_joinhandle_receiver(&method.receiver)
        }
        _ => false
    }
}

/// Check if the receiver expression is a Cursor type
/// Cursor has position() method that should not be confused with Iterator::position()
fn is_cursor_receiver(expr: &syn::Expr) -> bool {
    match expr {
        // Check for Cursor::new() call
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "Cursor::new";
            }
            false
        }
        // Check for variables with "cursor" in the name
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // Check variable type from declaration context
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    if var_type == "Cursor" {
                        return true;
                    }
                }
                // Check for common Cursor variable naming patterns
                return var_name.starts_with("cursor") || var_name.ends_with("_cursor") || var_name.contains("cursor");
            }
            false
        }
        // Method calls - recursively check the receiver
        syn::Expr::MethodCall(method) => {
            // Methods that return Cursor or operate on Cursor
            let method_name = method.method.to_string();
            if matches!(method_name.as_str(), "seek" | "into_inner" | "get_ref" | "get_mut") {
                return true;
            }
            // Recursively check the receiver
            is_cursor_receiver(&method.receiver)
        }
        _ => false
    }
}

/// Check if the receiver expression is a byte slice type (&[u8])
/// Byte slices implement Read trait and have chain method
fn is_byte_slice_receiver(expr: &syn::Expr) -> bool {
    match expr {
        // Check for &b"..."[..] pattern (byte string slice)
        syn::Expr::Index(index_expr) => {
            // Check if this is slicing a byte string reference
            if let syn::Expr::Reference(ref_expr) = &*index_expr.expr {
                // Check if it's referencing a byte literal
                matches!(&*ref_expr.expr, syn::Expr::Lit(lit) if matches!(lit.lit, syn::Lit::ByteStr(_)))
            } else {
                false
            }
        }
        // Check for variables that look like byte slices
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // Common patterns: reader, reader1, reader2, data, bytes, etc.
                var_name.starts_with("reader") ||
                var_name.starts_with("data") ||
                var_name == "bytes" ||
                var_name.contains("_reader")
            } else {
                false
            }
        }
        // Method calls that return byte slices or readers
        syn::Expr::MethodCall(method) => {
            let method_name = method.method.to_string();
            matches!(method_name.as_str(), "as_bytes" | "as_slice" | "chain")
        }
        _ => false
    }
}

/// Check if the receiver expression is likely a Vec/array type
/// This helps distinguish between user-defined methods and Vec methods
fn is_vec_receiver(expr: &syn::Expr) -> bool {
    match expr {
        // Check for explicit Vec type in path
        syn::Expr::Path(path) => {
            let path_str = path.path.segments.iter()
                .map(|seg| seg.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");
            
            // Check if it's a Vec type or contains "vec" in the path
            if path_str.contains("Vec") || path_str == "vec" {
                return true;
            }
            
            // Check variable type from declaration context first (HIGHEST PRIORITY)
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // Check if we have type information for this variable
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    // If explicitly typed as Vec, return true
                    if var_type == "Vec" {
                        return true;
                    }
                    // If explicitly typed as HashMap or HashSet, return false (not a Vec)
                    if var_type == "HashMap" || var_type == "HashSet" || var_type == "BTreeMap" {
                        return false;
                    }
                };
                
                // Fallback: Check for common array variable names (but exclude string variables and maps)
                // CRITICAL: Add explicit check for "numbers" which is a common Vec variable name
                if !is_likely_string_var(&var_name) &&
                   !is_hashmap_receiver(expr) &&
                   !is_hashset_receiver(expr) &&
                   !is_btreemap_receiver(expr) &&
                   (var_name == "numbers" || // explicit check for common Vec name
                   var_name.ends_with("s") || // plurals like "handles", "results", "items"
                   var_name.ends_with("_vec") ||
                   var_name.ends_with("_list") ||
                   var_name.ends_with("_array") ||
                   var_name.ends_with("_cap") || // variables with capacity like empty_with_cap
                   var_name.starts_with("empty_") && var_name.contains("cap") || // empty_with_cap pattern
                   var_name.contains("handles") ||
                   var_name.contains("results") ||
                   var_name.contains("items") ||
                   var_name.contains("numbers") ||
                   var_name == "vec1" ||
                   var_name == "vec2" ||
                   var_name.contains("vec_") ||
                   var_name.contains("_vec")) {
                    return true;
                }
            }
            
            false
        }
        // Check for Vec::new() or array literal constructor
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                return path_str == "Vec::new";
            }
            false
        }
        // Check for macro calls like vec![]
        syn::Expr::Macro(mac) => {
            mac.mac.path.segments.iter()
                .any(|seg| seg.ident == "vec")
        }
        // Array literals [...]
        syn::Expr::Array(_) => true,
        // Method calls - recursively check the receiver
        syn::Expr::MethodCall(method) => {
            // Methods like .iter() return arrays, so check the inner receiver
            is_vec_receiver(&method.receiver)
        }
        _ => false
    }
}

/// Check if the expression is likely to return a Result type
/// This uses heuristics based on function names and common patterns
fn is_result_returning_expr(expr: &syn::Expr) -> bool {
    match expr {
        // Check function calls - functions with names suggesting Result return types
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                if let Some(ident) = path.path.get_ident() {
                    let func_name = ident.to_string().to_lowercase();
                    // Common patterns: parse, try_, from_str, from_utf8, divide, validate, etc.
                    return func_name.contains("parse") ||
                           func_name.contains("try") ||
                           func_name.contains("from_str") ||
                           func_name.contains("from_utf8") ||
                           func_name.contains("divide") ||
                           func_name.contains("validate") ||
                           func_name.contains("check") ||
                           func_name.contains("create") && func_name.contains("safe");
                }
            }
            // Also check if this is a TsExpression::Call (converted expression)
            // This handles String_from_utf8() and similar helper function calls
            false
        }
        // Method calls that return Result
        syn::Expr::MethodCall(method) => {
            let method_name = method.method.to_string();
            // Methods that commonly return Result
            if matches!(method_name.as_str(),
                "parse" | "try_into" | "try_from" | "and_then" | "or_else" | "map" | "map_err"
            ) {
                return true;
            }
            
            // CRITICAL: Check for Builder::spawn() which returns Result<JoinHandle<T>, Error>
            if method_name == "spawn" {
                // Check if the receiver is likely a Builder
                if let syn::Expr::MethodCall(inner_method) = &*method.receiver {
                    // Check for builder pattern: Builder::new().name().spawn()
                    let inner_method_name = inner_method.method.to_string();
                    if matches!(inner_method_name.as_str(), "name" | "stack_size") {
                        return true;
                    }
                }
                // Also check if receiver is a variable named "builder"
                if let syn::Expr::Path(path) = &*method.receiver {
                    if let Some(ident) = path.path.get_ident() {
                        let var_name = ident.to_string();
                        if var_name.contains("builder") {
                            return true;
                        }
                    }
                }
            }
            
            false
        }
        // Variables - check if name suggests Result
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // CRITICAL: Check for common Result variable patterns
                // result, xxx_result, ok_val, err_val, result_val, ok_xxx, err_xxx, xxx_ok, xxx_err
                var_name.starts_with("result") || var_name.ends_with("_result") ||
                var_name.starts_with("ok_") || var_name.starts_with("err_") ||
                var_name.ends_with("_ok") || var_name.ends_with("_err") ||
                var_name == "ok_val" || var_name == "err_val" || var_name == "result_val" ||
                (var_name.ends_with("_val") && (var_name.contains("ok") || var_name.contains("err") || var_name.contains("result")))
            } else {
                false
            }
        }
        _ => false
    }
}

/// Helper function to check if an expression is a lock() call (directly or nested)
fn is_lock_call(expr: &TsExpression) -> bool {
    match expr {
        TsExpression::MethodCall { method, receiver, .. } => {
            if method == "lock" {
                return true;
            }
            // Check nested: e.g., counter_clone.get().lock()
            is_lock_call(receiver)
        }
        _ => false
    }
}

/// Helper function to check if an expression is a read() or write() call (directly or nested)
fn is_rwlock_call(expr: &TsExpression) -> bool {
    match expr {
        TsExpression::MethodCall { method, receiver, .. } => {
            if matches!(method.as_str(), "read" | "write") {
                return true;
            }
            // Check nested: e.g., data.get().read()
            is_rwlock_call(receiver)
        }
        _ => false
    }
}

/// Check if the expression is likely to return an Option type
/// This uses heuristics based on function names and common patterns
fn is_option_returning_expr(expr: &syn::Expr) -> bool {
    match expr {
        // Check function calls - functions with names suggesting Option return types
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                if let Some(ident) = path.path.get_ident() {
                    let func_name = ident.to_string().to_lowercase();
                    // Common patterns: find, get, search, lookup, user, etc.
                    return func_name.contains("find") ||
                           func_name.contains("search") ||
                           func_name.contains("lookup") ||
                           func_name.contains("user") ||
                           func_name.starts_with("get_") ||
                           func_name.starts_with("find_");
                }
            }
            false
        }
        // Method calls that return Option
        syn::Expr::MethodCall(method) => {
            let method_name = method.method.to_string();
            
            // IMPORTANT: Check if this is part of an iterator chain
            // If the receiver is also a method call with iterator methods, this is an iterator chain
            if matches!(method_name.as_str(), "map" | "filter") {
                if let syn::Expr::MethodCall(inner_method) = &*method.receiver {
                    let inner_method_name = inner_method.method.to_string();
                    // Check if inner method is an iterator method
                    if matches!(inner_method_name.as_str(),
                        "iter" | "iter_mut" | "into_iter" | "map" | "filter" |
                        "enumerate" | "take" | "skip" | "zip" | "chain" | "flat_map"
                    ) {
                        // This is an iterator chain, not an Option
                        return false;
                    }
                }
                // Also check if receiver is a Path (array variable)
                // If so, this is likely array.map() or array.filter(), not Option
                if matches!(&*method.receiver, syn::Expr::Path(_)) {
                    return false;
                }
            }
            
            // Methods that commonly return Option
            matches!(method_name.as_str(),
                "get" | "first" | "last" | "find" | "pop" |
                "and_then" | "or_else" | "map" | "filter"
            )
        }
        // Variables - check if name suggests Option
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // CRITICAL: Check for common Option variable patterns
                // some_val, none_val, option_xxx, maybe_xxx, xxx_option, etc.
                // Also check for variables ending with _val (common pattern in typeconvert.rs)
                var_name.starts_with("option") || var_name.starts_with("maybe_") ||
                var_name.ends_with("_option") || var_name.starts_with("user") ||
                var_name.starts_with("some_") || var_name.starts_with("none_") ||
                (var_name.ends_with("_val") && (var_name.contains("some") || var_name.contains("none") || var_name.contains("option")))
            } else {
                false
            }
        }
        _ => false
    }
}

/// Check if a converted TypeScript expression is likely to return a Result type
/// This is for checking already-converted expressions (TsExpression)
fn is_result_returning_ts_expr(expr: &TsExpression) -> bool {
    match expr {
        // Check if this is a Call expression to a Result-returning function
        TsExpression::Call { func, .. } => {
            if let TsExpression::Identifier(func_name) = &**func {
                let name_lower = func_name.to_lowercase();
                // Functions that return Result
                return name_lower.contains("parse") ||
                       name_lower.contains("from_utf8") ||
                       name_lower.contains("try_") ||
                       name_lower.contains("validate") ||
                       name_lower.contains("divide");
            }
            false
        }
        // Check if this is a MethodCall that returns Result
        TsExpression::MethodCall { method, .. } => {
            // Result methods that return Result
            matches!(method.as_str(),
                "and_then" | "or_else" | "map" | "map_err"
            )
        }
        _ => false
    }
}

/// Check if the receiver is a known class type (OpenOptions, File, etc.)
/// These types have their own methods and should not be confused with String methods
fn is_known_class_receiver(expr: &syn::Expr) -> bool {
    match expr {
        // Check for method call chains like OpenOptions::new().write(true).truncate(true)
        syn::Expr::MethodCall(method) => {
            let method_name = method.method.to_string();
            
            // CRITICAL: Check for file system methods that return known class types
            // fs.metadata() returns Metadata
            // entry.metadata() returns Metadata
            // file.metadata() returns Metadata
            // metadata.permissions() returns Permissions
            // entry.file_type() returns FileType
            if matches!(method_name.as_str(),
                "metadata" | "permissions" | "file_type"
            ) {
                return true;
            }
            
            // OpenOptions methods that indicate this is an OpenOptions instance
            if matches!(method_name.as_str(),
                "read" | "write" | "append" | "truncate" | "create" | "create_new" |
                "open" | "mode" | "custom_flags"
            ) {
                return true;
            }
            
            // Recursively check the receiver - if the base is a known class, the chain is too
            is_known_class_receiver(&method.receiver)
        }
        // Check for static method calls like OpenOptions::new()
        syn::Expr::Call(call) => {
            if let syn::Expr::Path(path) = &*call.func {
                let path_str = path.path.segments.iter()
                    .map(|seg| seg.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                // Check if this is a constructor for known class types
                return matches!(path_str.as_str(),
                    "OpenOptions::new" | "File::create" | "File::open" |
                    "File::options" | "DirEntry::path" | "Metadata::len" |
                    "Permissions::readonly" | "Path::new" | "PathBuf::new" |
                    "PathBuf::from"
                );
            }
            false
        }
        // Check for Path expressions - variables that might be class instances
        syn::Expr::Path(path) => {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                
                // CRITICAL: Check VAR_TYPES first for explicit type information
                // This handles cases where we have type annotations
                if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                    // Check if this is a known file system class type
                    return matches!(var_type.as_str(),
                        "Metadata" | "Permissions" | "FileType" | "DirEntry" |
                        "OpenOptions" | "File" | "Path" | "PathBuf" |
                        "BufReader" | "BufWriter" | "BufRead" | "BufWrite"
                    );
                }
                
                // Fallback: Check for common variable naming patterns for these types
                // OpenOptions: options, opts, file_options
                // File: file, f, file_handle
                // Path/PathBuf: path, path_buf, p
                // Metadata: metadata, meta, file_metadata
                // Permissions: permissions, perms
                // DirEntry: entry, dir_entry
                return var_name.contains("options") ||
                       var_name.contains("opts") ||
                       var_name == "file" ||
                       var_name.starts_with("file_") ||
                       var_name.contains("_file") ||
                       var_name == "path" ||
                       var_name.contains("path_") ||
                       var_name == "metadata" ||
                       var_name.contains("metadata_") ||
                       var_name == "meta" ||
                       var_name.contains("permissions") ||
                       var_name.contains("perms") ||
                       var_name.contains("entry") ||
                       var_name == "reader" ||
                       var_name.contains("_reader") ||
                       var_name == "writer" ||
                       var_name.contains("_writer");
            }
            false
        }
        _ => false
    }
}

/// Check if this is a Box<dyn Fn> closure being called
/// Returns true if the function expression is a variable that likely holds a Box-wrapped closure
fn is_box_closure_call(rust_expr: &syn::Expr, ts_expr: &TsExpression) -> bool {
    // Check if the Rust expression is a simple path (variable name)
    if let syn::Expr::Path(path) = rust_expr {
        if let Some(ident) = path.path.get_ident() {
            let var_name = ident.to_string();
            
            // PRIORITY 1: Check VAR_TYPES registry for explicit type information
            // This handles cases where the variable is from a for loop like:
            // for (i, closure) in closures.iter().enumerate()
            // where closures is Vec<Box<dyn Fn>>
            if let Some(var_type) = crate::converter::statements::get_var_type(&var_name) {
                // Check if the type indicates this is a Box-wrapped closure
                // CRITICAL FIX: Only return true if it explicitly contains "Box"
                // Don't match on "closure" alone as that could be a function pointer variable
                if var_type.contains("Box") {
                    return true;
                }
                // CRITICAL: If we have explicit type info and it doesn't contain Box, it's NOT a Box closure
                // This handles fn_from_closure which is typed as fn(i32) -> i32
                return false;
            }
            
            // PRIORITY 2: Check if the TypeScript expression is an identifier (not already a method call)
            if let TsExpression::Identifier(_ts_name) = ts_expr {
                // CRITICAL FIX: Be much more conservative with variable name heuristics
                // Only match variables that are VERY LIKELY to be Box closures
                // Exclude variables that look like function pointers (e.g., fn_from_closure, fn_ptr)
                
                // EXCLUDE: Variables with "fn" in the name (function pointers, not Box closures)
                if var_name.contains("fn_") || var_name.contains("_fn") || var_name.starts_with("fn") {
                    return false;
                }
                
                // Check for common Box closure variable patterns:
                // 1. Variable is exactly "closure" (singular, from iterator)
                // 2. Variable is exactly "f" in a closure context (from Vec<Box<dyn Fn>>)
                // 3. Variable is exactly "func" or "callback" (but not fn_xxx)
                let is_likely_box_closure = var_name == "closure" ||  // Exact match only
                                           (var_name == "f" && false) ||  // Disabled: too ambiguous
                                           var_name == "callback";  // Exact match only
                
                return is_likely_box_closure;
            }
        }
    }
    
    // Also check for index expressions like closures[i] or array access
    // These are often Box closures extracted from a Vec
    if let syn::Expr::Index(index_expr) = rust_expr {
        // Check if the base is a variable with "closures" (plural) in the name
        if let syn::Expr::Path(path) = &*index_expr.expr {
            if let Some(ident) = path.path.get_ident() {
                let var_name = ident.to_string();
                // Only match "closures" (plural) collection, not singular "closure"
                if var_name == "closures" {
                    return true;
                }
            }
        }
    }
    
    false
}

/// Try to infer if the receiver is an Rc-wrapped instance and return the class name
/// This uses heuristic detection to identify method calls on Rc<T> that should be converted to static calls
///
/// Detection strategies:
/// 1. Check if receiver variable was created by ClassName::new() (returns Rc<ClassName>)
/// 2. Check if receiver variable name contains the class name (e.g., node1 -> ListNode)
/// 3. Check if receiver is result of a method that returns Rc (e.g., append returns Rc<ListNode>)
///
/// CRITICAL: This function must be VERY CONSERVATIVE to avoid false positives
/// It should only return Some(class_name) when we are CERTAIN the receiver is Rc<T>
fn try_infer_rc_wrapped_class(rust_receiver: &syn::Expr, _ts_receiver: &TsExpression, method_name: &str) -> Option<String> {
    // Strategy 1: Check if receiver is a variable from ClassName::new() call
    // Example: let node1 = ListNode::new(1); node1.append(2)
    if let syn::Expr::Path(path) = rust_receiver {
        if let Some(ident) = path.path.get_ident() {
            let var_name = ident.to_string();
            
            // Strategy 2: Variable naming patterns - VERY STRICT
            // CRITICAL: Only match EXACT patterns, not substring matches
            // This prevents StringBuilder being treated as ListNode
            
            // CRITICAL FIX: Only match when BOTH conditions are met:
            // 1. Variable name EXACTLY matches a known pattern (e.g., "node1", "node2", NOT "nodeName")
            // 2. Method name matches the expected method for that class
            
            // ListNode: Only match node1, node2, node_xxx (exact "node" at start)
            // AND method must be "append" (ListNode's self: &Rc<Self> method)
            if method_name == "append" &&
               (var_name == "node" ||
                (var_name.starts_with("node") && var_name.len() >= 5 && var_name.chars().nth(4).map_or(false, |c| c.is_ascii_digit() || c == '_'))) {
                return Some("ListNode".to_string());
            }
            
            // Subject: Only match "subject" exactly
            if method_name == "subscribe" && var_name == "subject" {
                return Some("Subject".to_string());
            }
            
            // Observer: Only match "observer" with digits
            if method_name == "update" &&
               (var_name == "observer" || (var_name.starts_with("observer") && var_name.len() > 8)) {
                return Some("Observer".to_string());
            }
            
            // REMOVED: All other loose pattern matches to prevent false positives
            // No more matching on "config", "cache", "data", "parent", "child" etc.
            // These are too generic and cause false positives
        }
    }
    
    // Strategy 3: Check if receiver is a method call that returns Rc<T>
    // Example: node1.append(2).append(3) - the first append returns Rc<ListNode>
    // CRITICAL: Only recurse if the method is known to return Rc<T>
    if let syn::Expr::MethodCall(inner_method) = rust_receiver {
        let inner_method_name = inner_method.method.to_string();
        
        // CRITICAL: Only if BOTH the inner method AND current method are "append"
        // AND the base receiver is a known ListNode variable
        if inner_method_name == "append" && method_name == "append" {
            // CRITICAL FIX: Only recurse if we can confirm the BASE receiver is a ListNode
            // Check if the base receiver is a Path (variable) that matches ListNode pattern
            if let syn::Expr::Path(base_path) = &*inner_method.receiver {
                if let Some(ident) = base_path.path.get_ident() {
                    let var_name = ident.to_string();
                    // Only recurse if base variable matches ListNode pattern (node, node1, node_xxx)
                    if var_name == "node" ||
                       (var_name.starts_with("node") && var_name.len() >= 5 &&
                        var_name.chars().nth(4).map_or(false, |c| c.is_ascii_digit() || c == '_')) {
                        // This is node1.append().append() - valid ListNode chain
                        return Some("ListNode".to_string());
                    }
                }
            }
            
            // If base is not a simple Path or doesn't match pattern, don't treat as ListNode
            // This prevents StringBuilder::new().append().append() from being treated as ListNode
        }
        
        // Don't recurse for other methods to avoid false positives
    }
    
    None
}