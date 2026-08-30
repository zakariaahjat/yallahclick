/* ============================================================
   YallahClick — Template service (design / video / thumbnail)
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  function factory(key, seedData, typeLabel){
    var seed = function(){ return JSON.parse(JSON.stringify(seedData)); };
    return YC.createService(key, seed, {
      extend: {
        TYPE_LABEL: typeLabel,

        search: function(q){
          q = (q || '').trim().toLowerCase();
          if(!q) return this.all();
          return this.all().filter(function(t){
            return t.title.toLowerCase().indexOf(q) >= 0 ||
                   t.description.toLowerCase().indexOf(q) >= 0 ||
                   (t.tags || []).some(function(tg){ return tg.toLowerCase().indexOf(q) >= 0; });
          });
        },

        byFilters: function(filters){
          var list = this.all();
          if(filters){
            if(filters.type && filters.type !== 'all' && 'type' in filters){
              list = list.filter(function(t){ return String(t.type) === String(filters.type); });
            }
            if(filters.platform && filters.platform !== 'all' && 'platform' in filters){
              list = list.filter(function(t){ return t.platform === filters.platform; });
            }
            if(filters.software && filters.software !== 'all'){
              list = list.filter(function(t){
                return (t.software || '').toLowerCase().indexOf(filters.software.toLowerCase()) >= 0;
              });
            }
            if(filters.dimensions && filters.dimensions !== 'all'){
              list = list.filter(function(t){ return t.dimensions === filters.dimensions; });
            }
            if(filters.category && filters.category !== 'all'){
              list = list.filter(function(t){ return t.category === filters.category; });
            }
            if(filters.status && filters.status !== 'all'){
              list = list.filter(function(t){ return t.published === (filters.status === 'published'); });
            }
            if(filters.featured){
              list = list.filter(function(t){ return t.featured; });
            }
            if(filters.q){
              list = list.filter(function(t){
                var q = filters.q.toLowerCase();
                return t.title.toLowerCase().indexOf(q) >= 0 ||
                       t.description.toLowerCase().indexOf(q) >= 0 ||
                       (t.tags || []).some(function(tg){ return tg.toLowerCase().indexOf(q) >= 0; });
              });
            }
          }
          return list;
        },

        sortBy: function(list, mode){
          var arr = list.slice();
          switch(mode){
            case 'popular':
              arr.sort(function(a, b){ return (b.downloads || 0) - (a.downloads || 0); }); break;
            case 'newest':
              arr.sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); }); break;
            case 'title':
              arr.sort(function(a, b){ return a.title.localeCompare(b.title); }); break;
          }
          return arr;
        },

        togglePublish: function(id){
          var t = this.getById(id);
          if(!t) return null;
          return this.update(id, { published: !t.published });
        },

        toggleFeatured: function(id){
          var t = this.getById(id);
          if(!t) return null;
          return this.update(id, { featured: !t.featured });
        },

        incrementDownloads: function(id){
          var t = this.getById(id);
          if(!t) return;
          this.update(id, { downloads: (t.downloads || 0) + 1 });
        },

        incrementViews: function(id){
          var t = this.getById(id);
          if(!t) return;
          this.update(id, { views: (t.views || 0) + 1 });
        },

        popular: function(limit){
          return this.all().filter(function(t){ return t.published; })
            .sort(function(a, b){ return (b.downloads || 0) - (a.downloads || 0); })
            .slice(0, limit || 5);
        },

        latest: function(limit){
          return this.all().filter(function(t){ return t.published; })
            .sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); })
            .slice(0, limit || 6);
        }
      }
    });
  }

  YC.services.templates = factory('yc:templates', YC.data.templates, 'Template');
  YC.services.videoTemplates = factory('yc:video-templates', YC.data.videoTemplates, 'Video Template');
  YC.services.thumbnailTemplates = factory('yc:thumbnail-templates', YC.data.thumbnailTemplates, 'Thumbnail Template');

  YC.services.templates.seed();
  YC.services.videoTemplates.seed();
  YC.services.thumbnailTemplates.seed();
})();