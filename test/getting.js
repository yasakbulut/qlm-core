describe('QLM getting-related functionality', function() {
  var qlm, serviceURL = '/api/v1/products.json';
  beforeEach(function(){
    qlm = new QLM({
      serviceURL: serviceURL
    });

   setupMockjax();

    spyOn(jQuery, 'ajax').and.callThrough();
  });

  it('constructs the URL correctly from the state', function(){
  	expect(qlm.__getURL({})).toBe(serviceURL+'?');
  	expect(qlm.__getURL({
  		'start': 0
  	})).toBe(serviceURL+'?start=0');
  	expect(qlm.__getURL({
  		'start': 0,
  		'offset': 25
  	})).toBe(serviceURL+'?start=0&offset=25');
  	expect(qlm.__getURL({
  		'start': 0,
  		'offset': 25,
  		'tags': ['cool', 'awesome', 'rockin']
  	})).toBe(serviceURL+'?start=0&offset=25&tags=cool&tags=awesome&tags=rockin');
  });

  it('calls the endpoint on initial get()', function() {
    qlm.get(5);
    expect(jQuery.ajax).toHaveBeenCalled();
  });

  it('calls the endpoint when low on items', function(done) {
    var qlm = new QLM({
      serviceURL: serviceURL,
      lowItemThreshold: 45,
      parameterState:{
        count: 50
      }
    });
    qlm.get(3).then(function(){
      expect(jQuery.ajax.calls.count()).toBe(1);
      expect(qlm.__localCache.length).toBe(47);  
    }).then(function(){
      return qlm.get(2);
    }).then(function(){
      expect(jQuery.ajax.calls.count()).toBe(1);
      expect(qlm.__localCache.length).toBe(45);
    }).then(function(){
      return qlm.get(2);
    }).then(function(){
      expect(jQuery.ajax.calls.count()).toBe(2);
      // at this point, new items are being loaded.
      // when loading finishes, __localCache should have
      // 93 items (45 - 2 + 50). This will be tested 
      // in the next calls to then()
    }).then(function(){
      return qlm.get(1);
    }).then(function(){
      // no new items should be fetched.
      expect(jQuery.ajax.calls.count()).toBe(2);
      expect(qlm.__localCache.length).toBe(92);
    }).always(done);  
  });

  it('properly works when lowItemThreshold is equal to count', function(done){
    var qlm = new QLM({
      serviceURL: serviceURL,
      lowItemThreshold: 5,
      parameterState: {
        count: 5
      }
    });
    qlm.get(5).then(function(){
      expect(jQuery.ajax.calls.count()).toBe(1);
      expect(qlm.__localCache.length).toBe(0);  
    }).then(function(){
      return qlm.get(5);
    }).then(function(){
      expect(jQuery.ajax.calls.count()).toBe(2);
      expect(qlm.__localCache.length).toBe(0);
    }).always(done);  

  });

  
  it('properly increments the count value in the url', function(done){
      $.mockjax.clear();
     setupMockjax();
  
    var qlm = new QLM({
      serviceURL: serviceURL,
      lowItemThreshold: 5,
      parameterState: {
        count: 5
      }
    });
    qlm.get(5).then(function(){
      return qlm.get(5);
    }).then(function(){
      var urls = $.mockjax.mockedAjaxCalls().map(function(item){return item.url});
      expect(urls[0]).toBe(serviceURL+'?start=0&count=5');
      expect(urls[1]).toBe(serviceURL+'?start=5&count=5');
    }).always(done);
  });


  function setupMockjax(){

     var items = [];
    for(var i = 0; i < 150; i++){
      items.push({'title': 'title '+(i+1)});
    }

    $.mockjax({
       url: /start=([\d]+)&count=([\d]+)/,
       urlParams: ["start", "count"],
       response: function(settings){
        var start = parseInt(settings.urlParams.start);
        var count = parseInt(settings.urlParams.count);
        this.responseText = {
          items: items.slice(start, Math.min(start+count, items.length-1))
        };
       } 
     });
  }
});