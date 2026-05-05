let count = 0;

const eml = (x, y) => {
  count++;
  const result = Math.exp(x) - Math.log(y);
  return result;
}; 

const exp = (x) => eml(x,1)

const log = (x) => eml(1,exp(eml(1,x)))

const sub = (x,y) => eml(log(x),exp(y))

const add = (x,y) => sub(x,minus(y))

const inv = (x) => exp(minus(log(x)))

const prod = (x,y) => exp(log(x)+log(y)) 

const div = (x,y) => prod(x,inv(y)) 

const minus = (x) => sub(log(1),x)
