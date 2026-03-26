(module
  (func $pulseStrength (param $progress f32) (param $amplitude f32) (result f32)
    local.get $progress
    local.get $amplitude
    f32.mul
    local.get $progress
    f32.const 0.3
    f32.mul
    f32.add
    local.get $amplitude
    f32.min)
  
  (func $glitchFactor (param $progress f32) (param $intensity f32) (result f32)
    ;; A simple pseudo-randomish jitter based on progress
    local.get $progress
    f32.const 100.0
    f32.mul
    f32.ceil
    f32.const 7.0
    f32.mul
    f32.const 13.0
    f32.add
    f32.const 10.0
    f32.div
    local.get $intensity
    f32.mul
    f32.const 0.5
    f32.sub)

  (export "pulseStrength" (func $pulseStrength))
  (export "glitchFactor" (func $glitchFactor)))
