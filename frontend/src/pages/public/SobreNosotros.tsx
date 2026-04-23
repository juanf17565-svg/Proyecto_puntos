import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import { useEffect } from "react";
import { api } from "../../api";

type Pagina = {
  slug: string;
  titulo: string;
  contenido: string;
};

export function SobreNosotros() {
  useEffect(() => {
    document.body.classList.add("catalog-background");
    return () => {
      document.body.classList.remove("catalog-background");
    };
  }, []);

  const paginaQuery = useQuery({
    queryKey: ["paginas", "sobre-nosotros"],
    queryFn: () => api.get<Pagina>("/paginas/sobre-nosotros"),
  });

  const html = marked(paginaQuery.data?.contenido || "");

  return (
    <section className="pagina-page">
      <div className="pagina-card">
        {paginaQuery.isLoading ? <div className="pagina-placeholder">Cargando...</div> : null}
        {paginaQuery.error ? <div className="pagina-error">No se pudo cargar el contenido.</div> : null}

        {!paginaQuery.isLoading && !paginaQuery.error && paginaQuery.data ? (
          <div>
            <h1 className="pagina-title">{paginaQuery.data.titulo}</h1>
            <div className="pagina-content markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

