describe("A suite", function() {
  var qlm;
  beforeEach(function(){
    ds = new QLM({
      serviceURL: '/api/v1/products.json'
    });
  });
  it("contains spec with an expectation", function() {
    expect(true).toBe(true);
  });
});