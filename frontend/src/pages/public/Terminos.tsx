import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import { api } from "../../api";

type Pagina = {
  slug: string;
  titulo: string;
  contenido: string;
};

export function Terminos() {
  const paginaQuery = useQuery({
    queryKey: ["paginas", "terminos"],
    queryFn: () => api.get<Pagina>("/paginas/terminos"),
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

