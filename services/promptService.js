/* ============================================================
   YallahClick — AI Prompt service
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  var seed = function(){ return JSON.parse(JSON.stringify(YC.data.aiPrompts)); };

  YC.services.prompts = YC.createService('yc:prompts', seed, {
    extend: {
      PLATFORMS: ['ChatGPT', 'Claude', 'Gemini', 'Midjourney', 'DALL-E', 'Other'],

      search: function(q){
        q = (q || '').trim().toLowerCase();
        if(!q) return this.all();
        return this.all().filter(function(p){
          return p.title.toLowerCase().indexOf(q) >= 0 ||
                 p.description.toLowerCase().indexOf(q) >= 0 ||
                 p.prompt.toLowerCase().indexOf(q) >= 0 ||
                 p.tags.some(function(t){ return t.toLowerCase().indexOf(q) >= 0; });
        });
      },

      byFilters: function(filters){
        var list = this.all();
        if(filters){
          if(filters.category && filters.category !== 'all'){
            list = list.filter(function(p){ return p.category === filters.category; });
          }
          if(filters.platform && filters.platform !== 'all'){
            list = list.filter(function(p){ return p.platform === filters.platform; });
          }
          if(filters.status && filters.status !== 'all'){
            list = list.filter(function(p){ return p.published === (filters.status === 'published'); });
          }
          if(filters.featured){
            list = list.filter(function(p){ return p.featured; });
          }
          if(filters.q){
            list = list.filter(function(p){
              var q = filters.q.toLowerCase();
              return p.title.toLowerCase().indexOf(q) >= 0 ||
                     p.description.toLowerCase().indexOf(q) >= 0 ||
                     p.tags.some(function(t){ return t.toLowerCase().indexOf(q) >= 0; });
            });
          }
        }
        return list;
      },

      sortBy: function(list, mode){
        var arr = list.slice();
        switch(mode){
          case 'popular':
            arr.sort(function(a, b){ return (b.views || 0) - (a.views || 0); }); break;
          case 'favorites':
            arr.sort(function(a, b){ return (b.favorites || 0) - (a.favorites || 0); }); break;
          case 'newest':
            arr.sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); }); break;
          case 'title':
            arr.sort(function(a, b){ return a.title.localeCompare(b.title); }); break;
        }
        return arr;
      },

      togglePublish: function(id){
        var p = this.getById(id);
        if(!p) return null;
        return this.update(id, { published: !p.published });
      },

      toggleFeatured: function(id){
        var p = this.getById(id);
        if(!p) return null;
        return this.update(id, { featured: !p.featured });
      },

      incrementViews: function(id){
        var p = this.getById(id);
        if(!p) return;
        this.update(id, { views: (p.views || 0) + 1 });
      },

      popular: function(limit){
        return this.all().filter(function(p){ return p.published; })
          .sort(function(a, b){ return (b.views || 0) - (a.views || 0); })
          .slice(0, limit || 5);
      },
      latest: function(limit){
        return this.all().filter(function(p){ return p.published; })
          .sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); })
          .slice(0, limit || 6);
      },
      featured: function(){
        return this.all().filter(function(p){ return p.published && p.featured; });
      }
    }
  });

  YC.services.prompts.seed();
})();