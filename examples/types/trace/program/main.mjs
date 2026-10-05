// What does this print? Read it, don't run it.
const a = [1, 2, 3];
const b = a;
b.push(4);
const c = [...a];
c.push(5);
console.log(a.length, b.length, c.length);

const s = "5" + 3;
const t = "5" - 3;
console.log(s, t, typeof s, typeof t);

const fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => i);
}
console.log(fns.map((f) => f()).join(","));
