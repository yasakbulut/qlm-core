describe('Creation suite', function() {
  it('Throws an error when service url parameter is missing', function(){
  	function createNoArgs(){
  		var qlm = new QLM();
  	}
  	function createNoParams(){
  		var qlm = new QLM({});
  	}
  	expect(createNoArgs).toThrow();
  	expect(createNoParams).toThrow();
  });
  
});