# Próxima etapa: comparação externa com EntropyHub

Esta bateria já compara o núcleo otimizado com uma referência O(N²) independente e um benchmark analítico de dados uniformes iid. A comparação com uma biblioteca externa ainda não foi executada.

O próximo passo recomendado é executar os mesmos vetores em EntropyHub e no candidato, fixando explicitamente:

- versão da biblioteca;
- `m`, `tau=1`, base logarítmica natural e limiar `r = 0.2 × SD`;
- convenção de desvio-padrão (aqui usa-se desvio-padrão populacional);
- definição do número de templates e tratamento de pares próprios;
- política para A=0 ou B=0.

A documentação do EntropyHub define `SampEn(Sig, m=2, tau=1, r=0.2*np.std(Sig), Logx=np.exp(1))` como chamada de referência e expõe estimativas em diferentes dimensões. Não comparar valores padrão sem alinhar os parâmetros e a convenção finita-N.

Referências públicas para a etapa externa:
- EntropyHub documentation: https://www.entropyhub.xyz/
- Source repository: https://github.com/MattWillFlood/EntropyHub

A versão nesta bateria não declara equivalência numérica com EntropyHub, pois essa execução externa ainda não foi realizada neste ambiente.
